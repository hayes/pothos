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
  InputFieldsFromShape,
  OutputRefShape,
} from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';

export interface PageInfoShape {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface GlobalIDShape<Types extends SchemaTypes> {
  id: OutputShape<Types, 'ID'>;
  type: OutputType<Types> | string;
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

export interface ConnectionObjectOptions<Types extends SchemaTypes, ParentShape>  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  extends GiraphQLSchemaTypes.ObjectTypeOptions<Types, ParentShape> {
  name?: string;
}

export interface ConnectionEdgeObjectOptions<Types extends SchemaTypes, ParentShape>  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  extends GiraphQLSchemaTypes.ObjectTypeOptions<Types, ParentShape> {
  name?: string;
}

export type NodeBaseObjectOptionsForParam<
  Types extends SchemaTypes,
  Param extends ObjectParam<Types>,
  Interfaces extends InterfaceParam<Types>[]
> = (Param extends {
  new (...args: any[]): any;
}
  ? {
      isTypeOf?: (
        obj: OutputShape<Types, Interfaces[number]>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean;
    }
  : OutputShape<Types, Param> extends { __type: string }
  ? {
      isTypeOf?: (
        obj: OutputShape<Types, Interfaces[number]>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean;
    }
  : {
      isTypeOf: (
        obj: OutputShape<Types, Interfaces[number]>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean;
    }) &
  Omit<ObjectTypeOptions<Types, Param, OutputShape<Types, Param>, Interfaces>, 'isTypeOf'>;

export type NodeObjectOptions<
  Types extends SchemaTypes,
  Param extends ObjectParam<Types>,
  Interfaces extends InterfaceParam<Types>[]
> = NodeBaseObjectOptionsForParam<Types, Param, Interfaces> & {
  id: Omit<
    FieldOptionsFromKind<
      Types,
      OutputShape<Types, Param>,
      'ID',
      false,
      {},
      'Object',
      OutputShape<Types, Param>,
      MaybePromise<OutputShape<Types, 'ID'>>
    >,
    'type' | 'args' | 'nullable'
  >;
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
  Args extends InputFieldMap,
  Nullable extends boolean,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    'ID',
    Nullable,
    Args,
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve'
> & {
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    ShapeFromTypeParam<Types, OutputRefShape<GlobalIDShape<Types> | string>, true>,
    ResolveReturnShape
  >;
};

export type NodeIDFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  Nullable extends boolean,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    'ID',
    Nullable,
    Args,
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve'
> & {
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    ShapeFromTypeParam<Types, OutputRefShape<GlobalIDShape<Types> | string>, true>,
    ResolveReturnShape
  >;
};

export type GlobalIDListFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  Nullable extends FieldNullability<[unknown]>,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    ['ID'],
    Nullable,
    Args,
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve'
> & {
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    ShapeFromTypeParam<
      Types,
      [OutputRefShape<GlobalIDShape<Types> | string>],
      {
        list: false;
        items: true;
      }
    >,
    ResolveReturnShape
  >;
};

export type NodeFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    OutputRefShape<GlobalIDShape<Types> | string>,
    true,
    Args,
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'nullable'
> & {
  id: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    ShapeFromTypeParam<Types, OutputRefShape<GlobalIDShape<Types> | string>, true>,
    ResolveReturnShape
  >;
};

export type NodeListFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    [OutputRefShape<GlobalIDShape<Types> | string>],
    {
      list: false;
      items: true;
    },
    Args,
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'nullable'
> & {
  ids: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    ShapeFromTypeParam<
      Types,
      [OutputRefShape<GlobalIDShape<Types> | string>],
      {
        list: false;
        items: true;
      }
    >,
    ResolveReturnShape
  >;
};
