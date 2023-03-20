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

const pluginName = 'prismaUtils' as const;

export default pluginName;

function normalizeInputObject(object: unknown): unknown {
  if (!object) {
    return object;
  }

  if (typeof object !== 'object') {
    return object;
  }

  if (Array.isArray(object)) {
    return object.map(normalizeInputObject);
  }

  const mapped: Record<string, unknown> = {};

  (Object.keys(object) as (keyof typeof object)[]).forEach((key) => {
    mapped[key] = object[key] === null ? undefined : object[key];
  });

  return mapped;
}

export class PrismaUtilsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
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
        return true;
      }

      return null;
    });

    if (!argMappings) {
      return resolver;
    }

    const argMapper = createInputValueMapper(argMappings, (inputObject) =>
      normalizeInputObject(inputObject),
    );

    return (parent, args, context, info) => resolver(parent, argMapper(args), context, info);
  }
}

SchemaBuilder.registerPlugin(pluginName, PrismaUtilsPlugin);
