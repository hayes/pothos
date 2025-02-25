import './global-types';
import './schema-builder';
import SchemaBuilder, {
  BasePlugin,
  type BuildCache,
  createInputValueMapper,
  type InputTypeFieldsMapping,
  mapInputFields,
  type PothosOutputFieldConfig,
  type SchemaTypes,
  unwrapInputFieldType,
} from '@pothos/core';

export * from './types';

const pluginName = 'prismaUtils';

export default pluginName;

function normalizeInputObject(object: unknown, nullableFields: Set<string>): unknown {
  if (!object) {
    return object;
  }

  if (typeof object !== 'object') {
    return object;
  }

  if (Array.isArray(object)) {
    return object.map((o) => normalizeInputObject(o, nullableFields));
  }

  const mapped: Record<string, unknown> = {};

  for (const key of Object.keys(object) as (keyof typeof object)[]) {
    mapped[key] = !nullableFields.has(key) && object[key] === null ? undefined : object[key];
  }

  return mapped;
}

export class PothosPrismaUtilsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  private mappingCache = new Map<
    string,
    InputTypeFieldsMapping<Types, { nullableFields: Set<string> }>
  >();

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    const argMappings = mapInputFields(
      fieldConfig.args,
      this.buildCache,
      (inputField) => {
        const inputType = this.buildCache.getTypeConfig(unwrapInputFieldType(inputField.type));

        if (inputType.extensions?.pothosPrismaInput) {
          return (
            typeof inputType.extensions?.pothosPrismaInput === 'object'
              ? inputType.extensions?.pothosPrismaInput
              : {
                  nullableFields: new Set(),
                }
          ) as { nullableFields: Set<string> };
        }

        return null;
      },
      this.mappingCache,
    );

    if (!argMappings) {
      return fieldConfig;
    }

    const argMapper = createInputValueMapper(argMappings, (inputObject, mapping) =>
      normalizeInputObject(inputObject, mapping.value?.nullableFields ?? new Set()),
    );

    return {
      ...fieldConfig,
      argMappers: [...(fieldConfig.argMappers ?? []), (args) => argMapper(args)],
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaUtilsPlugin);
