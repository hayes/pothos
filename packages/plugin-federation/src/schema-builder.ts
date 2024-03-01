import {
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLUnionType,
  isObjectType,
  lexicographicSortSchema,
} from 'graphql';
import { printSubgraphSchema } from '@apollo/subgraph';
import { entitiesField, EntityType, serviceField } from '@apollo/subgraph/dist/types';
import SchemaBuilder, { MaybePromise, SchemaTypes } from '@pothos/core';
import { ExternalEntityRef } from './external-ref';
import { Selection, SelectionFromShape, selectionShapeKey } from './types';
import { entityMapping, getUsedDirectives, mergeDirectives } from './util';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

export function hasDirective(type: GraphQLNamedType, directive: string) {
  if (Array.isArray(type.extensions?.directives)) {
    return type.extensions?.directives.some((d) => (d as { name: string }).name === directive);
  }

  return directive in ((type.extensions?.directives ?? {}) as {});
}

schemaBuilderProto.selection = <Shape extends object>(selection: SelectionFromShape<Shape>) => ({
  selection,
  [selectionShapeKey]: {} as unknown as Shape,
});

schemaBuilderProto.externalRef = function externalRef<
  Name extends string,
  KeySelection extends Selection<object>,
  Shape extends object = KeySelection[typeof selectionShapeKey],
>(
  name: Name,
  key?: KeySelection | KeySelection[],
  resolveReference?: (
    parent: KeySelection[typeof selectionShapeKey],
    context: {},
    info: GraphQLResolveInfo,
  ) => MaybePromise<Shape | null | undefined>,
) {
  return new ExternalEntityRef<SchemaTypes, Shape, KeySelection>(this, name, {
    resolvable: key ? undefined : false,
    key,
    resolveReference,
  });
};

schemaBuilderProto.toSubGraphSchema = function toSubGraphSchema(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  {
    linkUrl = 'https://specs.apollo.dev/federation/v2.6',
    federationDirectives = getUsedDirectives(this),
    ...options
  },
) {
  const schema = this.toSchema({
    ...options,
    extensions: {
      ...options.extensions,
      directives: mergeDirectives(options?.extensions?.directives as {}, [
        {
          name: 'link',
          args: {
            url: linkUrl,
            import: [
              ...federationDirectives,
              options.composeDirectives ? '@composeDirective' : null,
            ].filter(Boolean),
          },
        },
        ...(options.composeDirectives?.map((name) => ({
          name: 'composeDirective',
          args: {
            name,
          },
        })) ?? []),
      ]),
    },
  });
  const queryType = schema.getType('Query') as GraphQLObjectType | undefined;
  const types = schema.getTypeMap();

  queryType?.toConfig();

  const entityTypes = Object.values(types).filter(
    (type) => isObjectType(type) && hasDirective(type, 'key'),
  );

  const hasEntities = entityTypes.length > 0;

  const updatedEntityType = new GraphQLUnionType({
    ...EntityType.toConfig(),
    types: entityTypes.filter(isObjectType),
  });

  const newQuery = new GraphQLObjectType({
    name: 'Query',
    description: queryType?.description,
    astNode: queryType?.astNode,
    extensions: queryType?.extensions,
    fields: {
      ...(hasEntities && {
        _entities: {
          ...entitiesField,
          type: new GraphQLNonNull(new GraphQLList(updatedEntityType)),
        },
      }),
      _service: {
        ...serviceField,
        resolve: () => ({ sdl }),
      },
      ...queryType?.toConfig().fields,
    },
  });

  const subGraphSchema = new GraphQLSchema({
    query: newQuery,
    mutation: schema.getType('Mutation') as GraphQLObjectType,
    subscription: schema.getType('Subscription') as GraphQLObjectType,
    extensions: schema.extensions,
    directives: schema.getDirectives(),
    extensionASTNodes: schema.extensionASTNodes,
    types: [
      ...Object.values(types).filter((type) => type.name !== 'Query'),
      newQuery,
      ...(hasEntities ? [updatedEntityType] : []),
    ],
  });

  const sorted = lexicographicSortSchema(subGraphSchema);

  const sdl = printSubgraphSchema(sorted);

  return sorted;
};

schemaBuilderProto.asEntity = function asEntity(param, options) {
  if (!entityMapping.has(this)) {
    entityMapping.set(this, new Map());
  }

  this.configStore.onTypeConfig(param, (config) => {
    entityMapping.get(this)!.set(config.name, options);
  });
};
