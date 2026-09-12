import './global-types.js';
import './schema-builder.js';
import SchemaBuilder, { BasePlugin, type RootName, type SchemaTypes } from '@pothos/core';
import { type GraphQLNamedType, GraphQLSchema } from 'graphql';
import { addTypeToSchema, isUnintendedRoot } from './utils.js';

const pluginName = 'addGraphQL';

export default pluginName;

const builtInTypes = Object.keys(new GraphQLSchema({}).getTypeMap());
export class PothosAddGraphQLPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override beforeBuild(): void {
    const { schema, types } = this.builder.options.add ?? {};

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

    for (const type of Array.isArray(types) ? types : Object.values(types ?? {})) {
      addTypeToSchema(this.builder, type);
    }

    const schemaTypes = Object.values(schema?.getTypeMap() ?? {}).filter(
      (type) => !builtInTypes.includes(type.name),
    );

    for (const type of schemaTypes) {
      // The operation roles of the imported schema are known, so types that are not roots are
      // explicitly marked as such rather than being inferred from their names.
      addTypeToSchema(this.builder, type, rootKinds.get(type) ?? null);
    }
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    // `toSchema` falls back to resolving operation roots by name, which can assign an imported type
    // to an operation it was not imported for, or to a second operation in addition to its own.
    const removeQuery = isUnintendedRoot(this.builder, schema.getQueryType(), 'Query');
    const removeMutation = isUnintendedRoot(this.builder, schema.getMutationType(), 'Mutation');
    const removeSubscription = isUnintendedRoot(
      this.builder,
      schema.getSubscriptionType(),
      'Subscription',
    );

    if (!removeQuery && !removeMutation && !removeSubscription) {
      return schema;
    }

    const config = schema.toConfig();

    return new GraphQLSchema({
      ...config,
      query: removeQuery ? undefined : config.query,
      mutation: removeMutation ? undefined : config.mutation,
      subscription: removeSubscription ? undefined : config.subscription,
    });
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosAddGraphQLPlugin);
