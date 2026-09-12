import './global-types.js';
import './schema-builder.js';
import SchemaBuilder, { BasePlugin, type RootName, type SchemaTypes } from '@pothos/core';
import { type GraphQLNamedType, GraphQLSchema } from 'graphql';
import { addTypeToSchema } from './utils.js';

const pluginName = 'addGraphQL';

export default pluginName;

const builtInTypes = Object.keys(new GraphQLSchema({}).getTypeMap());
export class PothosAddGraphQLPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override beforeBuild(): void {
    const { schema, types } = this.builder.options.add ?? {};

    const allTypes = [
      ...(Array.isArray(types) ? types : Object.values(types ?? {})),
      ...Object.values(schema?.getTypeMap() ?? {}).filter(
        (type) => !builtInTypes.includes(type.name),
      ),
    ];

    const rootKinds = new Map<GraphQLNamedType, RootName>();

    if (schema) {
      const roots: [RootName, GraphQLNamedType | null | undefined][] = [
        ['Query', schema.getQueryType()],
        ['Mutation', schema.getMutationType()],
        ['Subscription', schema.getSubscriptionType()],
      ];

      for (const [kind, rootType] of roots) {
        if (rootType) {
          rootKinds.set(rootType, kind);
        }
      }
    }

    for (const type of allTypes) {
      addTypeToSchema(this.builder, type, rootKinds.get(type));
    }
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosAddGraphQLPlugin);
