import {
  BuildCache,
  GiraphQLInputFieldConfig,
  GiraphQLInputFieldType,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  SchemaTypes,
} from '..';

interface InputTypeFieldsMapping<Types extends SchemaTypes, T> {
  configs: Record<string, GiraphQLInputFieldConfig<Types>>;
  map: InputFieldsMap<Types, T> | null;
}

type InputFieldMapping<Types extends SchemaTypes, T> =
  | {
      kind: 'Enum';
      isList: boolean;
      config: GiraphQLInputFieldConfig<Types>;
      value: T;
    }
  | {
      kind: 'InputObject';
      config: GiraphQLInputFieldConfig<Types>;
      isList: boolean;
      value: T | null;
      typeFields: InputTypeFieldsMapping<Types, T>;
    }
  | {
      kind: 'Scalar';
      isList: boolean;
      config: GiraphQLInputFieldConfig<Types>;
      value: T;
    };

type InputFieldsMap<Types extends SchemaTypes, T> = Map<string, InputFieldMapping<Types, T>>;

export function resolveInputTypeConfig<Types extends SchemaTypes>(
  type: GiraphQLInputFieldType<Types>,
  buildCache: BuildCache<Types>,
): Extract<GiraphQLTypeConfig, { kind: 'Enum' | 'InputObject' | 'Scalar' }> {
  if (type.kind === 'List') {
    return resolveInputTypeConfig(type.type, buildCache);
  }

  const config = buildCache.getTypeConfig(type.ref);

  if (config.kind === 'Enum' || config.kind === 'Scalar' || config.kind === 'InputObject') {
    return config;
  }

  throw new TypeError(`Unexpected config type ${config.kind} for input ref ${type.ref}`);
}

export function mapArgFields<Types extends SchemaTypes, T>(
  fieldConfig: GiraphQLOutputFieldConfig<Types>,
  buildCache: BuildCache<Types>,
  mapper: (config: GiraphQLInputFieldConfig<Types>) => T | null,
): InputFieldsMap<Types, T> | null {
  return mapInputFields(fieldConfig.args, buildCache, mapper);
}

export function mapInputFields<Types extends SchemaTypes, T>(
  inputs: { [name: string]: GiraphQLInputFieldConfig<Types> },
  buildCache: BuildCache<Types>,
  mapper: (config: GiraphQLInputFieldConfig<Types>) => T | null,
): InputFieldsMap<Types, T> | null {
  const filterMappings = new Map<InputFieldsMap<Types, T>, InputFieldsMap<Types, T>>();

  return filterMapped(internalMapInputFields(inputs, buildCache, mapper, new Map()));

  function filterMapped(map: InputFieldsMap<Types, T>) {
    if (filterMappings.has(map)) {
      return filterMappings.get(map)!;
    }

    const filtered = new Map<string, InputFieldMapping<Types, T>>();

    filterMappings.set(map, filtered);

    map.forEach((mapping, fieldName) => {
      if (mapping.kind === 'Enum' || mapping.kind === 'Scalar') {
        filtered.set(fieldName, mapping);

        return;
      }

      const hasNestedMappings = checkForMappings(mapping.typeFields.map!);

      if (mapping.value !== null || hasNestedMappings) {
        const filteredTypeFields = filterMapped(mapping.typeFields.map!);
        const mappingForType = {
          ...mapping,
          typeFields: {
            configs: mapping.typeFields!.configs,
            map: filteredTypeFields,
          },
        };

        filtered.set(fieldName, mappingForType);
      }
    });

    return filtered.size > 0 ? filtered : null;
  }

  function checkForMappings(
    map: InputFieldsMap<Types, T>,
    hasMappings = new Map<InputFieldsMap<Types, T>, boolean>(),
  ): boolean {
    if (hasMappings.has(map)) {
      return hasMappings.get(map)!;
    }

    hasMappings.set(map, false);

    let result = false;

    map.forEach((mapping) => {
      if (mapping.kind !== 'InputObject') {
        result = true;
      } else if (mapping.typeFields.map) {
        if (checkForMappings(mapping.typeFields.map, hasMappings)) {
          result = true;
        }
      }
    });

    hasMappings.set(map, result);

    return result;
  }
}

function internalMapInputFields<Types extends SchemaTypes, T>(
  inputs: { [name: string]: GiraphQLInputFieldConfig<Types> },
  buildCache: BuildCache<Types>,
  mapper: (config: GiraphQLInputFieldConfig<Types>) => T | null,
  seenTypes: Map<string, InputTypeFieldsMapping<Types, T>>,
) {
  const map = new Map<string, InputFieldMapping<Types, T>>();

  Object.keys(inputs).forEach((fieldName) => {
    const inputField = inputs[fieldName];
    const typeConfig = resolveInputTypeConfig(inputField.type, buildCache);
    const fieldMapping = mapper(inputField);

    if (typeConfig.kind === 'Enum' || typeConfig.kind === 'Scalar') {
      if (fieldMapping !== null) {
        map.set(fieldName, {
          kind: typeConfig.kind,
          isList: inputField.type.kind === 'List',
          config: inputField,
          value: fieldMapping,
        });
      }

      return;
    }

    const inputFieldConfigs = buildCache.getInputTypeFieldConfigs(
      inputField.type.kind === 'List' ? inputField.type.type.ref : inputField.type.ref,
    );

    if (!seenTypes.has(typeConfig.name)) {
      const typeEntry = {
        configs: inputFieldConfigs,
        map: new Map<string, InputFieldMapping<Types, T>>(),
      };

      seenTypes.set(typeConfig.name, typeEntry);

      typeEntry.map = internalMapInputFields(inputFieldConfigs, buildCache, mapper, seenTypes);
    }

    const typeFields = seenTypes.get(typeConfig.name)!;

    map.set(fieldName, {
      kind: typeConfig.kind,
      isList: inputField.type.kind === 'List',
      config: inputField,
      value: fieldMapping,
      typeFields,
    });
  });

  return map;
}

export function createInputValueMapper<Types extends SchemaTypes, T>(
  argMap: InputFieldsMap<Types, T>,
  mapValue: (val: unknown, mapping: InputFieldMapping<Types, T>) => unknown,
) {
  return function mapObject(obj: object, map: InputFieldsMap<Types, T> = argMap) {
    const mapped: Record<string, unknown> = { ...obj };

    map.forEach((field, fieldName) => {
      let fieldVal = (obj as Record<string, unknown>)[fieldName];

      if (fieldVal === null || fieldVal === undefined) {
        return;
      }

      if (field.kind === 'InputObject' && field.typeFields.map) {
        fieldVal = mapObject(fieldVal as Record<string, unknown>, field.typeFields.map);
        mapped[fieldName] = fieldVal;
      }

      if (field.kind !== 'InputObject' || field.value !== null) {
        mapped[fieldName] = field.isList
          ? (fieldVal as unknown[]).map((val) => mapValue(val, field))
          : mapValue(fieldVal, field);
      }
    });

    return mapped;
  };
}
