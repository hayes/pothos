import {
  type ArgumentRef,
  type FieldKind,
  type FieldMap,
  type FieldNullability,
  type FieldOptionsFromKind,
  type InferredFieldOptionKeys,
  type InferredFieldOptionsByKind,
  type InputFieldMap,
  type InputFieldsFromShape,
  type InputShapeFromFields,
  type InterfaceParam,
  type InterfaceRef,
  type InterfaceTypeOptions,
  type ListResolveValue,
  type MaybePromise,
  type Normalize,
  type ObjectRef,
  type ObjectTypeOptions,
  type OutputShape,
  type OutputType,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
  typeBrandKey,
} from '@pothos/core';
import type {
  BuildQueryResult,
  Column,
  DBQueryConfig,
  Many,
  Relation,
  RelationalSchemaConfig,
  SQL,
  TableRelationalConfig,
  TablesRelationalConfig,
} from 'drizzle-orm';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import type { DrizzleObjectFieldBuilder } from './drizzle-field-builder';
import type { DrizzleRef } from './interface-ref';
import type { IndirectInclude } from './utils/map-query';
import type { SelectionMap } from './utils/selections';

export type DrizzleClient = {
  _: Partial<RelationalSchemaConfig<TablesRelationalConfig>>;
  query: {};
};

export type DrizzlePluginOptions<Types extends SchemaTypes> = {
  maxConnectionSize?: number;
  defaultConnectionSize?: number;
  skipDeferredFragments?: boolean;
} & (
  | {
      client: DrizzleClient;
      schema?: Record<string, unknown>;
    }
  | {
      client: (ctx: Types['Context']) => DrizzleClient;
      schema: Record<string, unknown>;
    }
);

export const drizzleTableName = Symbol.for('Pothos.drizzleTableName');

type NameOrVariant =
  | {
      name?: never;
      variant?: string;
    }
  | {
      name?: string;
      variant?: never;
    };

export type DrizzleObjectOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces>, 'fields'> &
  NameOrVariant & {
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelationSchema'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  };

export type DrizzleInterfaceOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  InterfaceTypeOptions<Types, InterfaceRef<Types, Shape>, Shape, Interfaces> & {
    name: string;
    select?: Selection;
  },
  'fields'
> &
  NameOrVariant & {
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelationSchema'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  };

export type DrizzleNodeOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
  IDColumn extends Column,
> = NameOrVariant &
  Omit<
    | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
    | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
    'fields' | 'isTypeOf'
  > & {
    id: Omit<
      FieldOptionsFromKind<
        Types,
        Shape,
        'ID',
        false,
        {},
        'Object',
        OutputShape<Types, 'ID'>,
        MaybePromise<OutputShape<Types, 'ID'>>
      >,
      'args' | 'nullable' | 'type' | InferredFieldOptionKeys
    > & {
      column:
        | IDColumn
        | IDColumn[]
        | ((columns: Types['DrizzleRelationSchema'][Table]['columns']) => IDColumn | IDColumn[]);
    };
    name: string;
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelationSchema'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  };

export type DrizzleFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Table extends keyof Types['DrizzleRelationSchema'],
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Kind extends FieldKind,
  ResolveShape,
  ResolveReturnShape,
  Param,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args,
    Kind,
    ResolveShape,
    ResolveReturnShape
  >,
  'resolve' | 'type'
> & {
  type: Param;
  resolve: (
    query: <T extends QueryForDrizzleField<Types, Param, Table>>(selection?: T) => T,
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    ctx: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<ShapeFromTypeParam<Types, Type, Nullable>>;
};

export type DrizzleFieldWithInputOptions<
  Types extends SchemaTypes,
  ParentShape,
  Table extends keyof Types['DrizzleRelationSchema'],
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Kind extends FieldKind,
  ResolveShape,
  ResolveReturnShape,
  Param,
  InputName extends string,
  Fields extends InputFieldMap,
  ArgRequired extends boolean,
> = Omit<
  DrizzleFieldOptions<
    Types,
    ParentShape,
    Table,
    Type,
    Nullable,
    Args & {
      [K in InputName]: ArgumentRef<
        Types,
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    },
    Kind,
    ResolveShape,
    ResolveReturnShape,
    Param
  >,
  'args'
> &
  PothosSchemaTypes.FieldWithInputBaseOptions<Types, Args, Fields, InputName, ArgRequired>;

export type DrizzleObjectFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Select,
  ResolveReturnShape,
  ShapeWithSelection = Normalize<
    Omit<
      unknown extends Select
        ? ParentShape
        : BuildQueryResult<
            Types['DrizzleRelationSchema'],
            ExtractTable<Types, ParentShape>,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            Record<string, unknown> & (Select extends (...args: any[]) => infer R ? R : Select)
          > &
            ParentShape,
      typeof drizzleTableName
    >
  >,
> = PothosSchemaTypes.ObjectFieldOptions<
  Types,
  ShapeWithSelection,
  Type,
  Nullable,
  Args,
  ResolveReturnShape
> &
  InferredFieldOptionsByKind<
    Types,
    Types['InferredFieldOptionsKind'],
    ShapeWithSelection,
    Type,
    Nullable,
    Args,
    ResolveReturnShape
  > & {
    select?: Select &
      (
        | DBQueryConfig<
            'one',
            false,
            Types['DrizzleRelationSchema'],
            ExtractTable<Types, ParentShape>
          >
        | ((
            args: InputShapeFromFields<Args>,
            ctx: Types['Context'],
            nestedSelection: <Selection extends boolean | {}>(
              selection?: Selection,
              path?: string[],
            ) => Selection,
          ) => DBQueryConfig<
            'one',
            false,
            Types['DrizzleRelationSchema'],
            ExtractTable<Types, ParentShape>
          >)
      );
  };

export type DrizzleFieldSelection =
  | DBQueryConfig<'one', false>
  | ((
      args: {},
      ctx: object,
      mergeNestedSelection: (
        selection:
          | SelectionMap
          | boolean
          | ((args: object, context: object) => DBQueryConfig<'one', false>),
        path?: IndirectInclude | string[],
        type?: string,
      ) => DBQueryConfig<'one', false> | boolean,
      resolveSelection: (path: string[]) => FieldNode | null,
    ) => SelectionMap);

export type ExtractTable<Types extends SchemaTypes, Shape> = Shape extends {
  [drizzleTableName]?: keyof Types['DrizzleRelationSchema'];
}
  ? Types['DrizzleRelationSchema'][NonNullable<Shape[typeof drizzleTableName]>]
  : never;

export type RelatedFieldOptions<
  Types extends SchemaTypes,
  Table extends TableRelationalConfig,
  Field extends keyof Table['relations'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Shape,
> = Omit<
  DrizzleObjectFieldOptions<
    Types,
    Shape,
    RefForRelation<Types, Table['relations'][Field]>,
    Nullable,
    Args,
    {
      columns: {};
      with: { [K in Field]: true };
    },
    ResolveReturnShape
  >,
  'description' | 'resolve' | 'select' | 'type'
> & {
  description?: string | false;
  type?: ObjectRef<Types, TypesForRelation<Types, Table['relations'][Field]>>;
  query?: QueryForField<Types, Args, Table['relations'][Field]>;
};

export type VariantFieldOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'],
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  Variant extends DrizzleRef<any, Table> | Table,
  Args extends InputFieldMap,
  isNull,
  Shape,
  ResolveShape,
  ResolveReturnShape,
> = Omit<
  FieldOptionsFromKind<
    Types,
    Shape,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    Variant extends DrizzleRef<any> ? Variant : DrizzleRef<any, Table>,
    unknown extends isNull ? false : true,
    Args,
    'DrizzleObject',
    ResolveShape,
    ResolveReturnShape
  >,
  InferredFieldOptionKeys | 'type'
> & {
  isNull?: isNull &
    ((
      parent: Normalize<
        Omit<
          unknown extends ResolveShape
            ? Shape
            : BuildQueryResult<
                Types['DrizzleRelationSchema'],
                ExtractTable<Types, Shape>,
                Record<string, unknown> &
                  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                  (ResolveShape extends (...args: any[]) => infer R ? R : ResolveShape)
              > &
                Shape,
          typeof drizzleTableName
        >
      >,
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<boolean>);
};

export type RefForRelation<Types extends SchemaTypes, Rel extends Relation> = Rel extends {
  $relationBrand: 'One';
}
  ? ObjectRef<Types, TypesForRelation<Types, Rel>>
  : [ObjectRef<Types, TypesForRelation<Types, Rel>>];

export type TypesForRelation<Types extends SchemaTypes, Rel extends Relation> = BuildQueryResult<
  Types['DrizzleRelationSchema'],
  Types['DrizzleRelationSchemaByDbName'][Rel['referencedTableName']],
  true
>;

export type QueryForField<
  Types extends SchemaTypes,
  Args extends InputFieldMap,
  Rel extends Relation,
> = (
  Rel extends {
    $relationBrand: 'One';
  }
    ? Omit<
        DBQueryConfig<
          'one',
          false,
          Types['DrizzleRelationSchema'],
          Types['DrizzleRelationSchemaByDbName'][Rel['referencedTableName']]
        >,
        'columns' | 'extra' | 'with'
      >
    : Omit<
        DBQueryConfig<
          'many',
          false,
          Types['DrizzleRelationSchema'],
          Types['DrizzleRelationSchemaByDbName'][Rel['referencedTableName']]
        >,
        'columns' | 'extra' | 'with'
      >
) extends infer QueryConfig
  ? QueryConfig | ((args: InputShapeFromFields<Args>, context: Types['Context']) => QueryConfig)
  : never;

export type QueryForDrizzleField<
  Types extends SchemaTypes,
  Param,
  Table extends keyof Types['DrizzleRelationSchema'],
> = Omit<
  DBQueryConfig<
    'many',
    true,
    Types['DrizzleRelationSchema'],
    Types['DrizzleRelationSchema'][Table]
  >,
  Param extends [unknown] ? never : 'limit'
>;

export type QueryForRelatedConnection<
  Types extends SchemaTypes,
  Table extends TableRelationalConfig,
  Args,
> = Omit<
  DBQueryConfig<'many', false, Types['DrizzleRelationSchema'], Table>,
  'orderBy' | 'limit' | 'offset' | 'columns' | 'extra' | 'with'
> & {
  orderBy?: ConnectionOrderBy | ((columns: Table['columns']) => ConnectionOrderBy);
} extends infer QueryConfig
  ? QueryConfig | ((args: Args, context: Types['Context']) => QueryConfig)
  : never;

export type QueryForDrizzleConnection<
  Types extends SchemaTypes,
  Table extends TableRelationalConfig,
> = Omit<
  DBQueryConfig<'many', false, Types['DrizzleRelationSchema'], Table>,
  'orderBy' | 'limit' | 'offset'
> & {
  orderBy?: ConnectionOrderBy | ((columns: Table['columns']) => ConnectionOrderBy);
};

export type ListRelation<T extends TableRelationalConfig> = {
  [K in keyof T['relations']]: T['relations'][K] extends Many<string> ? K : never;
}[keyof T['relations']];

export type DrizzleConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  DrizzleRef<any, keyof Types['DrizzleRelationSchema']> | keyof Types['DrizzleRelationSchema'],
  TableConfig extends TableRelationalConfig,
  Param extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Param,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'Arg'> &
      (InputFieldMap extends Args ? {} : Args),
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'args' | 'resolve' | 'type'
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      ParentShape,
      Param,
      Nullable,
      false,
      false,
      Args,
      ResolveReturnShape
    >,
    'resolve' | 'type'
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? {
        type: Type;
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);

        resolve: (
          query: <T extends QueryForRelatedConnection<Types, TableConfig, ConnectionArgs>>(
            selection?: T,
          ) => Omit<T, 'orderBy'> & { orderBy: SQL },
          parent: ParentShape,
          args: ConnectionArgs,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => ShapeFromTypeParam<Types, [Param], Nullable> extends infer Shape
          ? [Shape] extends [[readonly (infer Item)[] | null | undefined]]
            ? ListResolveValue<Shape, Item, ResolveReturnShape>
            : MaybePromise<Shape>
          : never;
      }
    : never);

export type RelatedConnectionOptions<
  Types extends SchemaTypes,
  Shape,
  Table extends TableRelationalConfig,
  Field extends keyof Table['relations'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  NodeTable extends
    TableRelationalConfig = Types['DrizzleRelationSchemaByDbName'][Table['relations'][Field]['referencedTableName']],
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Shape,
    ObjectRef<Types, unknown>,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'InputObject'> &
      (InputFieldMap extends Args ? {} : Args),
    unknown
  >,
  'args' | 'resolve' | 'type'
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      Shape,
      ObjectRef<Types, unknown>,
      false,
      false,
      Nullable,
      Args,
      unknown
    >,
    'resolve' | 'type'
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? {
        resolve?: (
          parent: Shape,
          args: ConnectionArgs,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<
          ShapeFromTypeParam<
            Types,
            [ObjectRef<Types, TypesForRelation<Types, Table['relations'][Field]>>],
            Nullable
          >
        >;
        query?: QueryForRelatedConnection<Types, NodeTable, ConnectionArgs>;
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        type?: DrizzleRef<any, Table['relations'][Field]['referencedTableName']>;

        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        // totalCount?: NeedsResolve extends false ? boolean : false;
      }
    : never);

export type ConnectionOrderBy =
  | Column
  | { asc: Column }
  | { desc: Column }
  | (Column | { asc: Column } | { desc: Column })[];

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

export type DrizzleConnectionShape<
  Types extends SchemaTypes,
  T,
  Parent,
  Args extends InputFieldMap,
> = (
  ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, T, false>> extends infer Shape
    ? Shape & {
        parent: Parent;
        args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments;
      }
    : never
) extends infer C
  ? [C] extends [
      { edges: MaybePromise<readonly (infer Edge | null | undefined)[] | null | undefined> },
    ]
    ? Omit<C, 'edges'> & { edges: (Edge & { connection: C })[] }
    : C
  : never;

export type WithBrand<T> = T & { [typeBrandKey]: string };

export interface AddGraphQLInputTypeOptions<Types extends SchemaTypes, Shape extends {}>
  extends Omit<
    PothosSchemaTypes.InputObjectTypeOptions<
      Types,
      InputFieldsFromShape<Types, Shape, 'InputObject'>
    >,
    'fields'
  > {
  name?: string;
}

export interface DrizzleGraphQLInputExtensions {
  table: string;
  tableConfig: TableRelationalConfig;
  inputType: 'insert' | 'filters' | 'orderBy' | 'update';
}

export { DrizzleObjectRef } from './object-ref';
