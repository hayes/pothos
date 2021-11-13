import '@giraphql/plugin-directives';
import {
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  isObjectType,
  lexicographicSortSchema,
} from 'graphql';
import { printSubgraphSchema } from '@apollo/subgraph/dist/printSubgraphSchema';
import { entitiesField, EntityType, serviceField } from '@apollo/subgraph/dist/types';
import SchemaBuilder, {
  FieldBuilder,
  InterfaceParam,
  ObjectParam,
  ObjectRef,
  ObjectTypeOptions,
  OutputShape,
  ParentShape,
  RootFieldBuilder,
  SchemaTypes,
} from '@giraphql/core';
import {
  EntityObjectOptions,
  ExternalEntityOptions,
  Selection,
  SelectionFromShape,
  selectionShapeKey,
} from '.';

const schemaBuilderProto =
  SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

type DirectiveList = { name: string; args?: {} }[];
type DirectiveOption = DirectiveList | Record<string, {}>;

export function hasDirective(type: GraphQLNamedType, directive: string) {
  if (Array.isArray(type.extensions.directives)) {
    return type.extensions.directives.some((d) => (d as { name: string }).name === directive);
  }

  return directive in ((type.extensions.directives ?? {}) as {});
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

schemaBuilderProto.entity = function entity<
  Interfaces extends InterfaceParam<SchemaTypes>[],
  Param extends ObjectParam<SchemaTypes>,
  KeySelection extends Selection<object>,
>(
  param: Param,
  {
    key,
    directives,
    fields,
    ...options
  }: EntityObjectOptions<SchemaTypes, Param, Interfaces, KeySelection>,
): ObjectRef<OutputShape<SchemaTypes, Param>, ParentShape<SchemaTypes, Param>> {
  const mergedDirectives: {} = {
    directives: mergeDirectives(directives as [], keyDirective(key)) as [],
  };

  const ref = this.objectType(param, {
    ...mergedDirectives,
    ...(options as {} as ObjectTypeOptions<
      SchemaTypes,
      Param,
      ParentShape<SchemaTypes, Param>,
      Interfaces
    >),
  });

  this.objectFields(ref, (t) => ({
    ...fields?.(new FieldBuilder(t.typename, this, 'EntityObject', 'Object') as never),
  }));

  return ref;
};

schemaBuilderProto.externalEntity = function externalEntity<
  Name extends string,
  KeySelection extends Selection<object>,
  Shape extends KeySelection[typeof selectionShapeKey],
>(
  name: Name,
  {
    key,
    externalFields,
    fields,
    directives,
    ...options
  }: ExternalEntityOptions<SchemaTypes, KeySelection, Shape>,
): ObjectRef<Shape & { __typename: Name }> {
  const ref = this.objectRef<Shape & { __typename: Name }>(name);

  this.objectType<[], ObjectRef<Shape & { __typename: Name }>>(ref, {
    directives: mergeDirectives(directives as [], keyDirective(key)) as [],
    ...(options as {} as ObjectTypeOptions<
      SchemaTypes,
      ObjectParam<SchemaTypes>,
      Shape & { __typename: Name },
      []
    >),
    fields: (t) => ({
      ...fields?.(new FieldBuilder(name, this, 'ExtendedEntity', 'Object') as never),
      ...externalFields?.(new RootFieldBuilder(name, this, 'ExternalEntity', 'Object') as never),
    }),
  });

  return ref;
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
      type.extensions?.giraphqlOptions as { resolveReference: unknown }
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
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

    newType.resolveReference = (
      newType.extensions?.giraphqlOptions as { resolveReference: unknown }
    )?.resolveReference;
  });

  return sorted;
};
