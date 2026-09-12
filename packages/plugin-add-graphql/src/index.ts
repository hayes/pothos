import './global-types.js';
import './schema-builder.js';
import SchemaBuilder, { BasePlugin, type RootName, type SchemaTypes } from '@pothos/core';
import { type GraphQLNamedType, GraphQLSchema } from 'graphql';
import { addTypeToSchema, importedNonRootTypes } from './utils.js';

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
    // `toSchema` falls back to looking up the mutation and subscription roots by name when the
    // builder defines no root of that kind, which would turn an imported object that happens to be
    // named Mutation or Subscription into an operation root of the generated schema.
    const nonRootTypes = importedNonRootTypes(this.builder);
    const mutation = schema.getMutationType();
    const subscription = schema.getSubscriptionType();
    const removeMutation = !!mutation && nonRootTypes.has(mutation.name);
    const removeSubscription = !!subscription && nonRootTypes.has(subscription.name);

    if (!removeMutation && !removeSubscription) {
      return schema;
    }

    const config = schema.toConfig();

    return new GraphQLSchema({
      ...config,
      mutation: removeMutation ? undefined : config.mutation,
      subscription: removeSubscription ? undefined : config.subscription,
    });
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosAddGraphQLPlugin);
