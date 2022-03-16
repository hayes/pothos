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
import { federationDirectives } from '@apollo/subgraph/dist/directives';
import { entitiesField, EntityType, serviceField } from '@apollo/subgraph/dist/types';
import SchemaBuilder, { MaybePromise, SchemaTypes } from '@pothos/core';
import { ExternalEntityRef } from './external-ref';
import { Selection, SelectionFromShape, selectionShapeKey } from '.';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

type DirectiveList = { name: string; args?: {} }[];
type DirectiveOption = DirectiveList | Record<string, {}>;

export function hasDirective(type: GraphQLNamedType, directive: string) {
  if (Array.isArray(type.extensions?.directives)) {
    return type.extensions?.directives.some((d) => (d as { name: string }).name === directive);
  }

  return directive in ((type.extensions?.directives ?? {}) as {});
}

export function keyDirective(key: Selection<object> | Selection<object>[]): {
  name: string;
  args?: {};
}[] {
  if (Array.isArray(key)) {
    return key.map(({ selection }) => ({
      name: 'key',
      args: { fields: selection },
    }));
  }

  return [
    {
      name: 'key',
      args: { fields: key.selection },
    },
  ];
}

export function mergeDirectives(
  existing: DirectiveOption | undefined,
  add: DirectiveList,
): DirectiveList {
  if (!existing) {
    return [...add];
  }

  if (Array.isArray(existing)) {
    return [...existing, ...add];
  }

  return [...Object.keys(existing).map((name) => ({ name, args: existing[name] })), ...add];
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
  key: KeySelection | KeySelection[],
  resolveReference?: (
    parent: KeySelection[typeof selectionShapeKey],
    context: {},
    info: GraphQLResolveInfo,
  ) => MaybePromise<Shape | null | undefined>,
) {
  return new ExternalEntityRef<SchemaTypes, Shape, KeySelection>(this, name, key, resolveReference);
};

schemaBuilderProto.toSubGraphSchema = function toSubGraphSchema(options) {
  const schema = this.toSchema(options);
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

  entityTypes.forEach((type) => {
    // eslint-disable-next-line no-param-reassign
    (type as GraphQLObjectType & { resolveReference?: unknown }).resolveReference = (
      type.extensions?.pothosOptions as { resolveReference: unknown }
    )?.resolveReference;
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
    directives: [...schema.getDirectives(), ...federationDirectives],
    types: [
      ...Object.values(types).filter((type) => type.name !== 'Query'),
      newQuery,
      ...(hasEntities ? [updatedEntityType] : []),
    ],
  });

  const sorted = lexicographicSortSchema(subGraphSchema);

  const sdl = printSubgraphSchema(sorted);

  entityTypes.forEach((type) => {
    const newType = sorted.getType(type.name) as GraphQLObjectType & {
      resolveReference?: unknown;
    };

    newType.resolveReference = newType.extensions?.resolveReference;
  });

  return sorted;
};

export const entityMapping = new WeakMap<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PothosSchemaTypes.SchemaBuilder<any>,
  Map<
    string,
    {
      key: Selection<object> | Selection<object>[];
      resolveReference: (val: object, context: {}, info: GraphQLResolveInfo) => unknown;
    }
  >
>();

schemaBuilderProto.asEntity = function asEntity(param, options) {
  if (!entityMapping.has(this)) {
    entityMapping.set(this, new Map());
  }

  this.configStore.onTypeConfig(param, (config) => {
    entityMapping.get(this)!.set(config.name, options);
  });
};
