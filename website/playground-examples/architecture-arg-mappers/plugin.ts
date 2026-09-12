import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import { GraphQLError, type GraphQLFieldResolver } from 'graphql';

declare global {
  namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      architectureArgMappers: NameInputPlugin<Types>;
    }
  }
}

class NameInputError extends Error {}

export class NameInputPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (!fieldConfig.extensions?.normalizeName) {
      return fieldConfig;
    }

    return {
      ...fieldConfig,
      argMappers: [
        ...fieldConfig.argMappers,
        (args: Record<string, unknown>) => {
          if (typeof args.name !== 'string' || !args.name.trim()) {
            throw new NameInputError('Name must not be blank');
          }
          return { ...args, name: args.name.trim() };
        },
        async (args: Record<string, unknown>) => {
          // A real plugin could await a lookup or asynchronous validator here.
          if (args.name === 'reserved') {
            throw new NameInputError('Name is reserved');
          }
          return args;
        },
      ],
    };
  }

  override wrapArgMappers(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    if (!resolver || !fieldConfig.extensions?.normalizeName) {
      return resolver;
    }

    return async (parent, args, context, info) => {
      try {
        return await resolver(parent, args, context, info);
      } catch (error) {
        if (error instanceof NameInputError) {
          throw new GraphQLError(error.message, { extensions: { code: 'BAD_USER_INPUT' } });
        }
        throw error;
      }
    };
  }
}

export const pluginName = 'architectureArgMappers';
SchemaBuilder.registerPlugin(pluginName, NameInputPlugin);
