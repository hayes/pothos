import { GraphQLResolveInfo } from 'graphql';
import {
  EmptyToOptional,
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRequiredness,
  InputFieldMap,
  InputFieldRef,
  InputFieldsFromShape,
  InputRef,
  InputShape,
  InputShapeFromFields,
  inputShapeKey,
  InterfaceParam,
  MaybePromise,
  Normalize,
  ObjectFieldsShape,
  ObjectParam,
  ObjectRef,
  ObjectTypeOptions,
  OutputRef,
  OutputRefShape,
  OutputShape,
  OutputType,
  ParentShape,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@giraphql/core';

export type RelayPluginOptions<Types extends SchemaTypes> = EmptyToOptional<{
  clientMutationId?: 'omit' | 'optional' | 'required';
  cursorType?: 'ID' | 'String';
  nodeTypeOptions: Omit<GiraphQLSchemaTypes.ObjectTypeOptions<Types, unknown>, 'fields'>;
  pageInfoTypeOptions: Omit<GiraphQLSchemaTypes.ObjectTypeOptions<Types, PageInfoShape>, 'fields'>;
  nodeQueryOptions: Omit<
    GiraphQLSchemaTypes.QueryFieldOptions<
      Types,
      OutputRefShape<GlobalIDShape<Types> | string>,
      true,
      { id: InputFieldRef<InputShape<Types, 'ID'>> },
      Promise<unknown>
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  nodesQueryOptions: Omit<
    GiraphQLSchemaTypes.QueryFieldOptions<
      Types,
      [OutputRefShape<GlobalIDShape<Types> | string>],
      true,
      { ids: InputFieldRef<InputShape<Types, 'ID'>[]> },
      Promise<unknown>[]
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  mutationInputArgOptions: Omit<
    GiraphQLSchemaTypes.ArgFieldOptions<Types, InputRef<{}>, true>,
    'fields' | 'required' | 'type'
  >;
  clientMutationIdInputOptions: Omit<
    GiraphQLSchemaTypes.InputObjectFieldOptions<Types, 'ID', true>,
    'required' | 'type'
  >;
  clientMutationIdFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<
      Types,
      {},
      'ID',
      false,
      {},
      Types['Scalars']['ID']['Output']
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  cursorFieldOptions: Normalize<
    Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<
        Types,
        {},
        'ID' | 'String',
        false,
        {},
        Types['Scalars']['ID' | 'String']['Output']
      >,
      'args' | 'nullable' | 'resolve' | 'type'
    > & {
      type?: 'ID' | 'String';
    }
  >;
  nodeFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<
      Types,
      {},
      ObjectRef<{}>,
      false,
      {},
      GlobalIDShape<Types> | string
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  edgesFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<Types, {}, [ObjectRef<{}>], false, {}, unknown[]>,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  pageInfoFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<
      Types,
      {},
      OutputRef<PageInfoShape>,
      false,
      {},
      PageInfoShape
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  hasNextPageFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<Types, PageInfoShape, 'Boolean', false, {}, boolean>,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  hasPreviousPageFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<Types, PageInfoShape, 'Boolean', false, {}, boolean>,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  startCursorFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<
      Types,
      PageInfoShape,
      'ID' | 'String',
      false,
      {},
      string | null
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  endCursorFieldOptions: Omit<
    GiraphQLSchemaTypes.ObjectFieldOptions<
      Types,
      PageInfoShape,
      'ID' | 'String',
      false,
      {},
      string | null
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  >;
  beforeArgOptions: Omit<
    GiraphQLSchemaTypes.InputObjectFieldOptions<Types, 'ID' | 'String', false>,
    'required' | 'type'
  >;
  afterArgOptions: Omit<
    GiraphQLSchemaTypes.InputObjectFieldOptions<Types, 'ID' | 'String', false>,
    'required' | 'type'
  >;
  firstArgOptions: Omit<
    GiraphQLSchemaTypes.InputObjectFieldOptions<Types, 'Int', false>,
    'required' | 'type'
  >;
  lastArgOptions: Omit<
    GiraphQLSchemaTypes.InputObjectFieldOptions<Types, 'Int', false>,
    'required' | 'type'
  >;
  encodeGlobalID?: (typename: string, id: bigint | number | string) => string;
  decodeGlobalID?: (globalID: string) => {
    typename: string;
    id: string;
  };
}>;

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

export type ConnectionShape<Types extends SchemaTypes, T, Nullable> =
  | (Nullable extends false ? never : null | undefined)
  | (Types['Connection'] & {
      pageInfo: PageInfoShape;
      edges: (
        | {
            cursor: string;
            node: T;
          }
        | null
        | undefined
      )[];
    });

export type ConnectionShapeForType<
  Types extends SchemaTypes,
  Type extends OutputType<Types>,
  Nullable extends boolean,
> = ConnectionShape<Types, ShapeFromTypeParam<Types, Type, true>, Nullable>;

export type ConnectionShapeFromResolve<
  Types extends SchemaTypes,
  Type extends OutputType<Types>,
  Nullable extends boolean,
  Resolved,
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
  ResolveReturnShape,
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
  Interfaces extends InterfaceParam<Types>[],
> = Omit<ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>, 'isTypeOf'> &
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Param extends new (...args: any[]) => any
    ? {
        isTypeOf?: (
          obj: ParentShape<Types, Interfaces[number]>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => boolean;
      }
    : OutputShape<Types, Param> extends { __type: string }
    ? {
        isTypeOf?: (
          obj: ParentShape<Types, Interfaces[number]>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => boolean;
      }
    : {
        isTypeOf: (
          obj: ParentShape<Types, Interfaces[number]>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => boolean;
      });

export type NodeObjectOptions<
  Types extends SchemaTypes,
  Param extends ObjectParam<Types>,
  Interfaces extends InterfaceParam<Types>[],
> = NodeBaseObjectOptionsForParam<Types, Param, Interfaces> & {
  id: Omit<
    FieldOptionsFromKind<
      Types,
      ParentShape<Types, Param>,
      'ID',
      false,
      {},
      'Object',
      OutputShape<Types, 'ID'>,
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
  Kind extends FieldKind = FieldKind,
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
  Kind extends 'Arg' | 'InputObject',
> = Omit<GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, 'ID', Req>[Kind], 'type'>;

export type GlobalIDListInputFieldOptions<
  Types extends SchemaTypes,
  Req extends FieldRequiredness<['ID']>,
  Kind extends 'Arg' | 'InputObject',
> = Omit<GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, ['ID'], Req>[Kind], 'type'>;

export type NodeIDFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  Nullable extends boolean,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind,
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
  Kind extends FieldKind = FieldKind,
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
  Kind extends FieldKind = FieldKind,
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
  Kind extends FieldKind = FieldKind,
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

export type RelayMutationInputOptions<
  Types extends SchemaTypes,
  Fields extends InputFieldMap,
  InputName extends string,
> = Omit<GiraphQLSchemaTypes.InputObjectTypeOptions<Types, Fields>, 'fields'> & {
  name?: string;
  argName?: InputName;
  inputFields: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types, 'InputObject'>) => Fields;
};

export type RelayMutationFieldOptions<
  Types extends SchemaTypes,
  Fields extends InputFieldMap,
  Nullable extends boolean,
  InputName extends string,
  ResolveShape,
  ResolveReturnShape,
> = Omit<
  FieldOptionsFromKind<
    Types,
    Types['Root'],
    OutputRef<ResolveShape>,
    Nullable,
    {
      [K in InputName]: InputFieldRef<
        InputShapeFromFields<
          Fields & { clientMutationId: InputFieldRef<Types['Scalars']['ID']['Input']> }
        >
      >;
    },
    'Mutation',
    ResolveShape,
    ResolveReturnShape
  >,
  'args' | 'type'
>;

export type RelayMutationPayloadOptions<
  Types extends SchemaTypes,
  Shape,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  | GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>
  | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
  'fields'
> & {
  name?: string;
  outputFields: ObjectFieldsShape<Types, Shape>;
};
