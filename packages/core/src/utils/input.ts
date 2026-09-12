import type { BuildCache } from '../build-cache.js';
import { PothosSchemaError } from '../errors.js';
import type {
  PothosInputFieldConfig,
  PothosInputFieldType,
  PothosTypeConfig,
  SchemaTypes,
} from '../types/index.js';
import { unwrapInputFieldType } from './params.js';

export interface InputTypeFieldsMapping<Types extends SchemaTypes, T> {
  configs: Record<string, PothosInputFieldConfig<Types>>;
  map: InputFieldsMapping<Types, T> | null;
}

export type InputFieldMapping<Types extends SchemaTypes, T> =
  | {
      kind: 'Enum';
      isList: boolean;
      listDepth: number;
      config: PothosInputFieldConfig<Types>;
      value: T;
    }
  | {
      kind: 'InputObject';
      config: PothosInputFieldConfig<Types>;
      isList: boolean;
      listDepth: number;
      value: T | null;
      fields: InputTypeFieldsMapping<Types, T>;
    }
  | {
      kind: 'Scalar';
      isList: boolean;
      listDepth: number;
      config: PothosInputFieldConfig<Types>;
      value: T;
    };

export type InputFieldsMapping<Types extends SchemaTypes, T> = Map<
  string,
  InputFieldMapping<Types, T>
>;

export function resolveInputTypeConfig<Types extends SchemaTypes>(
  type: PothosInputFieldType<Types>,
  buildCache: BuildCache<Types>,
): Extract<PothosTypeConfig, { kind: 'Enum' | 'InputObject' | 'Scalar' }> {
  if (type.kind === 'List') {
    return resolveInputTypeConfig(type.type, buildCache);
  }

  const config = buildCache.getTypeConfig(type.ref);

  if (config.kind === 'Enum' || config.kind === 'Scalar' || config.kind === 'InputObject') {
    return config;
  }

  throw new PothosSchemaError(
    `Unexpected config type ${config.kind} for input ref ${String(type.ref)}`,
  );
}

export function mapInputFields<Types extends SchemaTypes, T>(
  inputs: Record<string, PothosInputFieldConfig<Types>>,
  buildCache: BuildCache<Types>,
  mapper: (config: PothosInputFieldConfig<Types>) => T | null,
  cache: Map<string, InputTypeFieldsMapping<Types, T>> = new Map(),
): InputFieldsMapping<Types, T> | null {
  const filterMappings = new Map<InputFieldsMapping<Types, T>, InputFieldsMapping<Types, T>>();
  const hasMappings = new Map<InputFieldsMapping<Types, T>, boolean>();

  return filterMapped(internalMapInputFields(inputs, buildCache, mapper, cache));

  function filterMapped(map: InputFieldsMapping<Types, T>) {
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

      const hasNestedMappings = mapping.fields.map
        ? checkForMappings(mapping.fields.map, hasMappings)
        : false;

      if (mapping.value !== null || hasNestedMappings) {
        const filteredTypeFields = mapping.fields.map ? filterMapped(mapping.fields.map) : null;
        const mappingForType = {
          ...mapping,
          fields: {
            configs: mapping.fields.configs,
            map: filteredTypeFields,
          },
        };

        filtered.set(fieldName, mappingForType);
      }
    });

    return filtered.size > 0 ? filtered : null;
  }

  // Input types may be mutually recursive, so a plain memoizing DFS would cache the provisional
  // `false` it records before descending into a cycle and then treat it as final, hiding mapped
  // fields that are only reachable through the cycle. Instead collect everything reachable from
  // `map` and propagate `true` to a fixed point before recording any answer.
  function checkForMappings(
    map: InputFieldsMapping<Types, T>,
    hasMappings: Map<InputFieldsMapping<Types, T>, boolean>,
  ): boolean {
    if (hasMappings.has(map)) {
      return hasMappings.get(map)!;
    }

    const nested = new Map<InputFieldsMapping<Types, T>, InputFieldsMapping<Types, T>[]>();
    const results = new Map<InputFieldsMapping<Types, T>, boolean>();
    const queue = [map];

    while (queue.length > 0) {
      const current = queue.pop()!;

      // Already discovered in this walk, or already resolved by an earlier (completed) walk.
      if (nested.has(current) || hasMappings.has(current)) {
        continue;
      }

      const children: InputFieldsMapping<Types, T>[] = [];
      let hasDirectMapping = false;

      for (const mapping of current.values()) {
        if (mapping.value !== null) {
          hasDirectMapping = true;
        } else if (mapping.kind === 'InputObject' && mapping.fields.map) {
          children.push(mapping.fields.map);
          queue.push(mapping.fields.map);
        }
      }

      nested.set(current, children);
      results.set(current, hasDirectMapping);
    }

    let changed = true;

    while (changed) {
      changed = false;

      for (const [current, children] of nested) {
        if (results.get(current)) {
          continue;
        }

        for (const child of children) {
          if (results.has(child) ? results.get(child)! : hasMappings.get(child)!) {
            results.set(current, true);
            changed = true;
            break;
          }
        }
      }
    }

    for (const [current, result] of results) {
      hasMappings.set(current, result);
    }

    return results.get(map)!;
  }
}

function internalMapInputFields<Types extends SchemaTypes, T>(
  inputs: Record<string, PothosInputFieldConfig<Types>>,
  buildCache: BuildCache<Types>,
  mapper: (config: PothosInputFieldConfig<Types>) => T | null,
  seenTypes: Map<string, InputTypeFieldsMapping<Types, T>>,
) {
  const map = new Map<string, InputFieldMapping<Types, T>>();

  for (const [fieldName, inputField] of Object.entries(inputs)) {
    const typeConfig = resolveInputTypeConfig(inputField.type, buildCache);
    const fieldMapping = mapper(inputField);

    if (typeConfig.kind === 'Enum' || typeConfig.kind === 'Scalar') {
      if (fieldMapping !== null) {
        map.set(fieldName, {
          kind: typeConfig.kind,
          isList: inputField.type.kind === 'List',
          listDepth: getListDepth(inputField.type),
          config: inputField,
          value: fieldMapping,
        });
      }

      continue;
    }

    const inputFieldConfigs = buildCache.getInputTypeFieldConfigs(
      unwrapInputFieldType(inputField.type),
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
      listDepth: getListDepth(inputField.type),
      config: inputField,
      value: fieldMapping,
      fields: typeFields,
    });
  }

  return map;
}

export function createInputValueMapper<Types extends SchemaTypes, T, Args extends unknown[] = []>(
  argMap: InputFieldsMapping<Types, T>,
  mapValue: (val: unknown, mapping: InputFieldMapping<Types, T>, ...args: Args) => unknown,
) {
  return function mapObject(
    obj: object,
    map: InputFieldsMapping<Types, T> = argMap,
    ...args: Args
  ) {
    const mapped: Record<string, unknown> = { ...obj };

    map.forEach((field, fieldName) => {
      let fieldVal = (obj as Record<string, unknown>)[fieldName];

      if (fieldVal === null || fieldVal === undefined) {
        return;
      }

      if (field.kind === 'InputObject' && field.fields.map) {
        fieldVal = mapListValue(
          fieldVal,
          field.listDepth,
          (val) => val && mapObject(val, field.fields.map!, ...args),
        );

        mapped[fieldName] = fieldVal;
      }

      if (field.kind !== 'InputObject' || field.value !== null) {
        mapped[fieldName] = mapListValue(fieldVal, field.listDepth, (val) =>
          val == null ? val : mapValue(val, field, ...args),
        );
      }
    });

    return mapped;
  };
}

function getListDepth<Types extends SchemaTypes>(type: PothosInputFieldType<Types>): number {
  let depth = 0;
  let current = type;

  while (current.kind === 'List') {
    depth++;
    current = current.type;
  }

  return depth;
}

function mapListValue(
  value: unknown,
  listDepth: number,
  mapper: (val: unknown) => unknown,
): unknown {
  if (listDepth === 0) {
    return mapper(value);
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) =>
    listDepth > 1 ? mapListValue(item, listDepth - 1, mapper) : mapper(item),
  );
}
