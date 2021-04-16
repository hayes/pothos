import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRequiredness,
  InputFieldMap,
  InputFieldRef,
  InputFieldsFromShape,
  InputShape,
  InputShapeFromFields,
  inputShapeKey,
  InterfaceParam,
  MaybePromise,
  ObjectParam,
  ObjectRef,
  ObjectTypeOptions,
  OutputRefShape,
  OutputShape,
  OutputType,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@giraphql/core';

export interface RelayPluginOptions<Types extends SchemaTypes> {
  nodeTypeOptions: Omit<GiraphQLSchemaTypes.ObjectTypeOptions<Types, unknown>, 'fields'>;
  pageInfoTypeOptions: Omit<GiraphQLSchemaTypes.ObjectTypeOptions<Types, PageInfoShape>, 'fields'>;
  nodeQueryOptions: Omit<
    GiraphQLSchemaTypes.QueryFieldOptions<
      Types,
      ObjectRef<PageInfoShape>,
      true,
      { id: InputFieldRef<InputShape<Types, 'ID'>> },
      Promise<unknown>
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  nodesQueryOptions: Omit<
    GiraphQLSchemaTypes.QueryFieldOptions<
      Types,
      ObjectRef<PageInfoShape>,
      true,
      { ids: InputFieldRef<InputShape<Types, 'ID'>[]> },
      Promise<unknown>[]
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  encodeGlobalID?: (typename: string, id: bigint | number | string) => string;
  decodeGlobalID?: (
    globalID: string,
  ) => {
    typename: string;
    id: string;
  };
}

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
  | (Nullable extends false ? never : null | undefined)
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
    };

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

export type NodeBaseObjectOptionsForParam<
  Types extends SchemaTypes,
  Param extends ObjectParam<Types>,
  Interfaces extends InterfaceParam<Types>[]
> = Omit<ObjectTypeOptions<Types, Param, OutputShape<Types, Param>, Interfaces>, 'isTypeOf'> &
  (Param extends {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      });

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
    'args' | 'nullable' | 'type'
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
  'resolve' | 'type'
> & {
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    ShapeFromTypeParam<Types, OutputRefShape<GlobalIDShape<Types> | string>, true>,
    ResolveReturnShape
  >;
};

export type GlobalIDInputFieldOptions<
  Types extends SchemaTypes,
  Req extends boolean,
  Kind extends 'Arg' | 'InputObject'
> = Omit<GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, 'ID', Req>[Kind], 'type'>;

export type GlobalIDListInputFieldOptions<
  Types extends SchemaTypes,
  Req extends FieldRequiredness<['ID']>,
  Kind extends 'Arg' | 'InputObject'
> = Omit<GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, ['ID'], Req>[Kind], 'type'>;

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
  'resolve' | 'type'
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
  'resolve' | 'type'
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
  'nullable' | 'resolve' | 'type'
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
  'nullable' | 'resolve' | 'type'
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

export interface GlobalIDInputShape {
  [inputShapeKey]: {
    typename: string;
    id: string;
  };
}
