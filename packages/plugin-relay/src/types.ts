import {
  SchemaTypes,
  OutputType,
  FieldNullability,
  InputFieldMap,
  Resolver,
  InputShapeFromFields,
  ShapeFromTypeParam,
} from '@giraphql/core';

export interface PageInfoShape {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface NodeShape {
  id: string;
}

export type ConnectionShape<T> = {
  pageInfo: PageInfoShape;
  edges: {
    cursor: string;
    node: T;
  }[];
};

export type ConnectionShapeForType<
  Types extends SchemaTypes,
  Type extends OutputType<Types>,
  Nullable extends FieldNullability<Type>
> = ConnectionShape<ShapeFromTypeParam<Types, Type, Nullable>>;

export type ConnectionShapeFromResolve<
  Types extends SchemaTypes,
  Type extends OutputType<Types>,
  Nullable extends FieldNullability<Type>,
  Resolved
> = Resolved extends Promise<infer T>
  ? T extends ConnectionShapeForType<Types, Type, Nullable>
    ? T
    : never
  : Resolved extends ConnectionShapeForType<Types, Type, Nullable>
  ? Resolved
  : never;

export interface ConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends OutputType<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  ResolveReturnShape
> {
  type: Type;
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['context'],
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
