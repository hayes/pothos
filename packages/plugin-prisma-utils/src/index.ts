import './global-types';
import './schema-builder';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  BuildCache,
  createInputValueMapper,
  mapInputFields,
  PothosOutputFieldConfig,
  SchemaTypes,
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

  (Object.keys(object) as (keyof typeof object)[]).forEach((key) => {
    mapped[key] = !nullableFields.has(key) && object[key] === null ? undefined : object[key];
  });

  return mapped;
}

export class PothosPrismaUtilsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object, unknown> {
    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (inputField) => {
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
    });

    if (!argMappings) {
      return resolver;
    }

    const argMapper = createInputValueMapper(argMappings, (inputObject, mapping) =>
      normalizeInputObject(inputObject, mapping.value?.nullableFields ?? new Set()),
    );

    return (parent, args, context, info) => resolver(parent, argMapper(args), context, info);
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaUtilsPlugin);
