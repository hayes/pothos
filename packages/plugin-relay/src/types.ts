import {
  SchemaTypes,
  OutputType,
  FieldNullability,
  InputFieldMap,
  Resolver,
  InputShapeFromFields,
  ShapeFromTypeParam,
  ObjectTypeOptions,
  ObjectParam,
  OutputShape,
  InterfaceParam,
  MaybePromise,
  FieldOptionsFromKind,
  FieldKind,
  TypeParam,
  InputFieldsFromShape,
} from '@giraphql/core';

export interface PageInfoShape {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface NodeReturnShape<Types extends SchemaTypes> {
  id: OutputShape<Types, 'ID'>;
  __type: OutputType<Types>;
}

export type ConnectionShape<T, Nullable> =
  | {
      pageInfo: PageInfoShape;
      edges: (
        | {
            cursor: string;
            node: T;
          }
        | null
        | undefined
      )[];
    }
  | (Nullable extends false ? never : null | undefined);

export type ConnectionShapeForType<
  Types extends SchemaTypes,
  Type extends OutputType<Types>,
  Nullable extends boolean
> = ConnectionShape<ShapeFromTypeParam<Types, Type, true>, Nullable>;

export type ConnectionShapeFromResolve<
  Types extends SchemaTypes,
  Type extends OutputType<Types>,
  Nullable extends boolean,
  Resolved
> = Resolved extends Promise<infer T>
  ? T extends ConnectionShapeForType<Types, Type, Nullable>
    ? T
    : never
  : Resolved extends ConnectionShapeForType<Types, Type, Nullable>
  ? Resolved
  : never;

export interface DefaultConnectionArguments {
  first?: number | null | undefined;
  last?: number | null | undefined;
  before?: string | null | undefined;
  after?: string | null | undefined;
}

export interface ConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape
> {
  args?: Args;
  type: Type;
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args & InputFieldsFromShape<DefaultConnectionArguments>>,
    Types['Context'],
    ConnectionShapeForType<Types, Type, Nullable>,
    ResolveReturnShape
  >;
}

export interface ConnectionObjectOptions<Types extends SchemaTypes, ParentShape>
  extends GiraphQLSchemaTypes.ObjectTypeOptions<Types, ParentShape> {
  name?: string;
}

export interface ConnectionEdgeObjectOptions<Types extends SchemaTypes, ParentShape>
  extends GiraphQLSchemaTypes.ObjectTypeOptions<Types, ParentShape> {
  name?: string;
}

export type NodeObjectOptions<
  Types extends SchemaTypes,
  Param extends ObjectParam<Types>,
  Interfaces extends InterfaceParam<Types>[]
> = ObjectTypeOptions<Types, Param, OutputShape<Types, Param>, Interfaces> & {
  loadOne?: (
    id: string,
    context: Types['Context'],
  ) => MaybePromise<OutputShape<Types, Param> | null | undefined>;
  loadMany?: (
    ids: string[],
    context: Types['Context'],
  ) => MaybePromise<MaybePromise<OutputShape<Types, Param> | null | undefined>[]>;
};

export type GlobalIDFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Args extends InputFieldMap,
  Nullable extends FieldNullability<Type>,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args,
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'isTypeOf'
> & {
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    Type extends [unknown]
      ? { id: OutputShape<Types, 'ID'>; type: OutputType<Types> }[]
      : { id: OutputShape<Types, 'ID'>; type: OutputType<Types> },
    ResolveReturnShape
  >;
};
