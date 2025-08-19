import {
  type ArgumentRef,
  type BaseFieldOptionsFromKind,
  type DistributeOmit,
  type FieldKind,
  type FieldMap,
  type FieldNullability,
  type InferredFieldOptionsByKind,
  type InputFieldMap,
  type InputFieldsFromShape,
  type InputShapeFromFields,
  type InterfaceParam,
  type InterfaceRef,
  type InterfaceTypeOptions,
  type ListResolveValue,
  type MaybePromise,
  type Merge,
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
  AnyRelations,
  BuildQueryResult,
  Column,
  DBQueryConfig,
  Many,
  Relation,
  Table,
  TableRelationalConfig,
} from 'drizzle-orm';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import type { DrizzleObjectFieldBuilder } from './drizzle-field-builder';
import type { DrizzleRef } from './interface-ref';
import type { IndirectInclude } from './utils/map-query';
import type { SelectionMap } from './utils/selections';

export type DrizzleClient = {
  readonly _: {
    readonly schema: unknown;
    readonly fullSchema: Record<string, unknown>;
    readonly tableNamesMap: Record<string, string>;
    readonly relations: AnyRelations;
  };
  query: {};
};

export type DrizzlePluginOptions<Types extends SchemaTypes> = {
  maxConnectionSize?: number;
  defaultConnectionSize?: number;
  skipDeferredFragments?: boolean;
} & (
  | {
      client: DrizzleClient;
      getTableConfig: (table: Table) => {
        primaryKeys: {
          readonly columns: Column[];
        }[];
        readonly columns: Column[];
      };
      relations?: Types['DrizzleRelations'];
    }
  | {
      client: (ctx: Types['Context']) => DrizzleClient;
      getTableConfig: (table: Table) => {
        primaryKeys: {
          readonly columns: Column[];
        }[];
        readonly columns: Column[];
      };
      relations?: Types['DrizzleRelations'];
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
  Table extends keyof Types['DrizzleRelationsConfig'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces>, 'fields'> &
  NameOrVariant & {
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelationsConfig'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  };

export type DrizzleInterfaceOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationsConfig'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<InterfaceTypeOptions<Types, InterfaceRef<Types, Shape>, Shape, Interfaces>, 'fields'> &
  NameOrVariant & {
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelationsConfig'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  };

export type DrizzleNodeOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationsConfig'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
  IDColumns,
> = NameOrVariant &
  Omit<
    | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
    | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
    'fields' | 'isTypeOf'
  > & {
    id: Omit<
      BaseFieldOptionsFromKind<
        Types,
        Shape,
        'ID',
        false,
        {},
        'Object',
        OutputShape<Types, 'ID'>,
        MaybePromise<OutputShape<Types, 'ID'>>
      >,
      'args' | 'nullable' | 'type'
    > & {
      column: IDColumns &
        (
          | Column
          | Column[]
          | ((columns: Types['DrizzleRelationsConfig'][Table]['columns']) => Column | Column[])
        );
    };
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelationsConfig'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  } & NameOrVariant;

export type ShapeFromIdColumns<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationsConfig'],
  IDColumns,
> = IDColumns extends Column
  ? IDColumns['_']['data']
  : IDColumns extends Column[]
    ? {
        [K in IDColumns[number]['_']['name']]: Extract<
          IDColumns[number],
          { _: { name: K } }
        >['_']['data'];
      }
    : // biome-ignore lint/suspicious/noExplicitAny: this is fine
      IDColumns extends ((...args: any[]) => infer R extends Column | Column[])
      ? ShapeFromIdColumns<Types, Table, R>
      : never;

export type DrizzleFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Table extends keyof Types['DrizzleRelationsConfig'],
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Kind extends FieldKind,
  ResolveShape,
  ResolveReturnShape,
  Param,
> = Omit<
  BaseFieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args,
    Kind,
    ResolveShape,
    ResolveReturnShape
  >,
  'type'
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
  Table extends keyof Types['DrizzleRelationsConfig'],
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
> = DistributeOmit<
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

export type DrizzleBaseObjectFieldOptions<
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
            Types['DrizzleRelationsConfig'],
            ExtractTable<Types, ParentShape>,
            Record<string, unknown> &
              // biome-ignore lint/suspicious/noExplicitAny: this is fine
              Select extends (...args: any[]) => infer R
              ? R & { columns: {} }
              : Select & { columns: {} }
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
> & {
  select?: Select &
    (
      | DBQueryConfig<'one', Types['DrizzleRelationsConfig'], ExtractTable<Types, ParentShape>>
      | ((
          args: InputShapeFromFields<Args>,
          ctx: Types['Context'],
          nestedSelection: <Selection extends boolean | {}>(
            selection?: Selection,
            path?: string[],
          ) => Selection,
        ) => DBQueryConfig<
          'one',
          Types['DrizzleRelationsConfig'],
          ExtractTable<Types, ParentShape>
        >)
    );
};

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
            Types['DrizzleRelationsConfig'],
            ExtractTable<Types, ParentShape>,
            // biome-ignore lint/suspicious/noExplicitAny: this is fine
            Record<string, unknown> & (Select extends (...args: any[]) => infer R ? R : Select)
          > &
            ParentShape,
      typeof drizzleTableName
    >
  >,
> = DrizzleBaseObjectFieldOptions<
  Types,
  ParentShape,
  Type,
  Nullable,
  Args,
  Select,
  ResolveReturnShape,
  ShapeWithSelection
> &
  InferredFieldOptionsByKind<
    Types,
    Types['InferredFieldOptionsKind'],
    ShapeWithSelection,
    Type,
    Nullable,
    Args,
    ResolveReturnShape
  >;

export type DrizzleFieldSelection =
  | DBQueryConfig<'one'>
  | ((
      args: {},
      ctx: object,
      mergeNestedSelection: (
        selection:
          | SelectionMap
          | boolean
          | ((args: object, context: object) => DBQueryConfig<'one'>),
        path?: IndirectInclude | string[],
        type?: string,
      ) => DBQueryConfig<'one'> | boolean,
      resolveSelection: (path: string[]) => FieldNode | null,
    ) => SelectionMap);

export type ExtractTable<Types extends SchemaTypes, Shape> = Shape extends {
  [drizzleTableName]?: keyof Types['DrizzleRelationsConfig'];
}
  ? Types['DrizzleRelationsConfig'][NonNullable<Shape[typeof drizzleTableName]>]
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
  DrizzleBaseObjectFieldOptions<
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
  'description' | 'select' | 'type'
> & {
  description?: string | false;
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  type?: DrizzleRef<any, Table['relations'][Field]['targetTable']['_']['name']>;
  query?: QueryForField<Types, Args, Table['relations'][Field]>;
};

export type VariantFieldOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationsConfig'],
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  Variant extends DrizzleRef<any, Table> | Table,
  Args extends InputFieldMap,
  isNull,
  Shape,
  ResolveShape,
  ResolveReturnShape,
> = Omit<
  BaseFieldOptionsFromKind<
    Types,
    Shape,
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    Variant extends DrizzleRef<any> ? Variant : DrizzleRef<any, Table>,
    unknown extends isNull ? false : true,
    Args,
    'DrizzleObject',
    ResolveShape,
    ResolveReturnShape
  >,
  'type'
> & {
  isNull?: isNull &
    ((
      parent: Normalize<
        Omit<
          unknown extends ResolveShape
            ? Shape
            : BuildQueryResult<
                Types['DrizzleRelationsConfig'],
                ExtractTable<Types, Shape>,
                Record<string, unknown> &
                  // biome-ignore lint/suspicious/noExplicitAny: this is fine
                  ResolveShape extends (...args: any[]) => infer R
                  ? R & { columns: {} }
                  : ResolveShape & { columns: {} }
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
  Types['DrizzleRelationsConfig'],
  Types['DrizzleRelationsConfig'][Rel['targetTable']['_']['name']],
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
          Types['DrizzleRelationsConfig'],
          Types['DrizzleRelationsConfig'][Rel['targetTable']['_']['name']]
        >,
        'columns' | 'extra' | 'with'
      >
    : Omit<
        DBQueryConfig<
          'many',
          Types['DrizzleRelationsConfig'],
          Types['DrizzleRelationsConfig'][Rel['targetTable']['_']['name']]
        >,
        'columns' | 'extra' | 'with'
      >
) extends infer QueryConfig
  ? QueryConfig | ((args: InputShapeFromFields<Args>, context: Types['Context']) => QueryConfig)
  : never;

export type QueryForDrizzleField<
  Types extends SchemaTypes,
  Param,
  Table extends keyof Types['DrizzleRelationsConfig'],
> = Omit<
  DBQueryConfig<
    'many',
    Types['DrizzleRelationsConfig'],
    Types['DrizzleRelationsConfig'][Table],
    true
  >,
  Param extends [unknown] ? never : 'limit'
>;

export type QueryForRelatedConnection<
  Types extends SchemaTypes,
  Table extends TableRelationalConfig,
  Args,
> = Omit<
  DBQueryConfig<'many', Types['DrizzleRelationsConfig'], Table>,
  'limit' | 'offset' | 'columns' | 'extra' | 'with' | 'orderBy'
> & {
  orderBy?: ConnectionOrderBy<Table> | ((columns: Table['columns']) => ConnectionOrderBy<Table>);
} extends infer QueryConfig
  ? QueryConfig | ((args: Args, context: Types['Context']) => QueryConfig)
  : never;

export type QueryForDrizzleConnection<
  Types extends SchemaTypes,
  Table extends TableRelationalConfig,
> = Omit<
  DBQueryConfig<'many', Types['DrizzleRelationsConfig'], Table>,
  'limit' | 'offset' | 'orderBy'
> & {
  orderBy?: ConnectionOrderBy<Table> | ((columns: Table['columns']) => ConnectionOrderBy<Table>);
};

export type ListRelation<T extends TableRelationalConfig> = {
  [K in keyof T['relations']]: T['relations'][K] extends Many<string, string> ? K : never;
}[keyof T['relations']];

export type DrizzleConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends // biome-ignore lint/suspicious/noExplicitAny: this is fine
  DrizzleRef<any, keyof Types['DrizzleRelationsConfig']> | keyof Types['DrizzleRelationsConfig'],
  TableConfig extends TableRelationalConfig,
  Param extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind,
> = Omit<
  BaseFieldOptionsFromKind<
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
  'args' | 'type'
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
    'type' | 'resolve'
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
          ) => Omit<T, 'orderBy'> & {
            orderBy: {
              [K in keyof TableConfig['columns']]?: 'asc' | 'desc' | undefined;
            };
          },
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
    TableRelationalConfig = Types['DrizzleRelationsConfig'][Table['relations'][Field]['targetTable']['_']['name']],
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
  'args' | 'type'
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
    'type' | 'resolve'
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
        // biome-ignore lint/suspicious/noExplicitAny: this is fine
        type?: DrizzleRef<any, Table['relations'][Field]['targetTable']['_']['name']>;

        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        // totalCount?: NeedsResolve extends false ? boolean : false;
      }
    : never);

export type ConnectionOrderBy<T extends TableRelationalConfig> =
  | Column
  | Column[]
  | {
      [K in keyof T['columns']]?: 'asc' | 'desc' | undefined;
    };

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

export type DrizzleConnectionShape<
  Types extends SchemaTypes,
  T,
  Parent,
  Args extends InputFieldMap,
> = Merge<
  ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, T, false>> extends infer Shape
    ? Shape & {
        parent: Parent;
        args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments;
      }
    : never
> extends infer C
  ? [C] extends [
      {
        edges: infer Edges;
      },
    ]
    ? Merge<
        Omit<C, 'edges'> & {
          edges: Edges extends Iterable<MaybePromise<infer Edge> | null | undefined>
            ? Merge<Edge & { connection: C }>[]
            : never;
        }
      >
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
