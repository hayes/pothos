import {
  type ArgumentRef,
  type CheckAsyncSelection,
  type DistributeOmit,
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
  type MaybeAsyncSelection,
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
import type { IndirectInclude, IndirectPathSegment, PathSegment } from '@pothos/selection-mapper';
import type {
  AnyRelations,
  BuildQueryResult,
  Column,
  DBQueryConfig,
  Many,
  Relation,
  SQL,
  SQLWrapper,
  Table,
  TableRelationalConfig,
} from 'drizzle-orm';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import type { DrizzleObjectFieldBuilder } from './drizzle-field-builder.js';
import type { DrizzleRef } from './interface-ref.js';
import type { SelectionMap } from './utils/selections.js';

/**
 * A segment of a `path` given to `queryFromInfo` or `nestedSelection`: a field name, or
 * `{ name, type }` to pin the type the field must be selected under (a fragment on it).
 */
export type { IndirectInclude, IndirectPathSegment, PathSegment };

export interface FieldPathInfo {
  field: string;
  alias: string;
  parentType: string;
  isList: boolean;
}

export interface PathInfo {
  path: string[];
  segments: FieldPathInfo[];
}

export type DrizzleClient<TCountSource = Table | SQL | SQLWrapper> = {
  readonly _: {
    readonly relations: AnyRelations;
  };
  query: Record<
    string,
    {
      // Each table accepts its own schema-specific config. The loader supplies that config.
      findMany: (config: never) => PromiseLike<Record<string, unknown>[]>;
    }
  >;
  $count: (source: TCountSource, filter?: SQL) => SQL<number>;
  /** Core SQL construction used for relation predicates and counts; it does not execute a query. */
  select: (fields: Record<string, SQL>) => {
    from(table: Extract<TCountSource, Table>): {
      innerJoin(
        table: Extract<TCountSource, Table>,
        on: SQL,
      ): { where: (filter?: SQL) => SQLWrapper };
      where: (filter?: SQL) => SQLWrapper;
    };
  };
};

type GetTableConfigFn<TTable = Table> = (table: TTable) => {
  primaryKeys: {
    readonly columns: Column[];
  }[];
  uniqueConstraints?: {
    readonly columns: Column[];
  }[];
  readonly columns: Column[];
};

type AnyRelationTable<Types extends SchemaTypes> =
  Types['DrizzleRelations'][keyof Types['DrizzleRelations']]['table'];

type DrizzleClientForTypes<Types extends SchemaTypes> = DrizzleClient<
  AnyRelationTable<Types> | SQL | SQLWrapper
>;

type DrizzlePluginBaseOptions = {
  maxConnectionSize?: number;
  defaultConnectionSize?: number;
  skipDeferredFragments?: boolean;
  /**
   * When `true` (the default), the `totalCount` of a `relatedConnection` applies the `where`
   * returned by the field's `query`, so it counts the same rows the connection paginates. Set to
   * `false` to count every related row regardless of the filter.
   */
  filterConnectionTotalCount?: boolean;
};

export type DrizzlePluginOptions<Types extends SchemaTypes> = DrizzlePluginBaseOptions &
  (
    | {
        client: DrizzleClientForTypes<Types>;
        getTableConfig: GetTableConfigFn<AnyRelationTable<Types>>;
        relations?: Types['DrizzleRelations'];
      }
    | {
        client: (ctx: Types['Context']) => DrizzleClientForTypes<Types>;
        getTableConfig: GetTableConfigFn<AnyRelationTable<Types>>;
        relations: Types['DrizzleRelations'];
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
  Table extends keyof Types['DrizzleRelations'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces>, 'fields'> &
  NameOrVariant & {
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelations'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  };

export type DrizzleInterfaceOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelations'],
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<InterfaceTypeOptions<Types, InterfaceRef<Types, Shape>, Shape, Interfaces>, 'fields'> &
  NameOrVariant & {
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelations'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  };

export type DrizzleNodeOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelations'],
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
      column: IDColumns &
        (
          | Column
          | Column[]
          | ((columns: Types['DrizzleRelations'][Table]['table']) => Column | Column[])
        );
    };
    select?: Selection;
    fields?: (
      t: DrizzleObjectFieldBuilder<
        Types,
        Types['DrizzleRelations'][Table],
        Shape & { [drizzleTableName]?: Table }
      >,
    ) => FieldMap;
  } & NameOrVariant;

export type ShapeFromIdColumns<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelations'],
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
  Table extends keyof Types['DrizzleRelations'],
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
  'type' | InferredFieldOptionKeys
> & {
  type: Param;
  resolve: (
    query: <T = {}>(
      selection?: T & QueryForDrizzleField<Types, Param, Table>,
    ) => Omit<T, 'columns' | 'extra'> & {
      columns: T extends { columns: infer C extends {} } ? C : {};
      extras: {
        $pothosQueryFor: SQL<Table | undefined>;
      } & (T extends { extra: infer E } ? E : {});
    },
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    ctx: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<ShapeFromTypeParam<Types, Type, Nullable>>;
};

export type DrizzleFieldWithInputOptions<
  Types extends SchemaTypes,
  ParentShape,
  Table extends keyof Types['DrizzleRelations'],
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
            Types['DrizzleRelations'],
            ExtractTable<Types, ParentShape>,
            Record<string, unknown> &
              // biome-ignore lint/suspicious/noExplicitAny: this is fine
              Select extends (...args: any[]) => infer R
              ? Awaited<R> & { columns: {} }
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
    /**
     * What the field needs from its parent row. With `AsyncSelections: true` the function may be
     * async, and `nestedSelection` is then a promise when a selection beneath it is async, and
     * must be awaited.
     */
    select?: Select &
      CheckAsyncSelection<Types, Select> &
      (
        | DBQueryConfig<'one', Types['DrizzleRelations'], ExtractTable<Types, ParentShape>>
        | ((
            args: InputShapeFromFields<Args>,
            ctx: Types['Context'],
            nestedSelection: NestedSelectionFn<Types, Type, Args>,
          ) => MaybeAsyncSelection<
            Types,
            DBQueryConfig<'one', Types['DrizzleRelations'], ExtractTable<Types, ParentShape>>
          >)
      );
  };

/** The table a field's type param names: a drizzle ref, or a list of one. */
export type TableForTypeParam<Types extends SchemaTypes, Type> = Type extends [infer Item]
  ? TableForTypeParam<Types, Item>
  : // biome-ignore lint/suspicious/noExplicitAny: matching against any ref
    Type extends DrizzleRef<any, infer Table>
    ? Table & keyof Types['DrizzleRelations']
    : never;

/**
 * The query config for the table a field's type param names (a `many` config for a list field),
 * or never when the type has no table.
 */
export type QueryForTypeParam<Types extends SchemaTypes, Type> =
  TableForTypeParam<Types, Type> extends infer Table
    ? [Table] extends [never]
      ? never
      : DBQueryConfig<
          Type extends [unknown] ? 'many' : 'one',
          Types['DrizzleRelations'],
          Types['DrizzleRelations'][Table & keyof Types['DrizzleRelations']]
        >
    : never;

/**
 * What `nestedSelection` returns: the query config for the field's table, keeping the keys of
 * the given selection as they were given (so `columns` in it still narrow the parent shape).
 * With no selection, or `true`, it is the config itself. A field whose type has no table keeps
 * the selection it was given.
 */
export type NestedSelectionResult<Types extends SchemaTypes, Type, Selection> = [
  QueryForTypeParam<Types, Type>,
] extends [never]
  ? Selection
  : Selection extends boolean
    ? QueryForTypeParam<Types, Type>
    : Normalize<Omit<QueryForTypeParam<Types, Type>, keyof Selection> & Selection>;

/**
 * The callback a field's `select` function plans the selection beneath the field with: `path`
 * walks a field nested under the field's type, `type` names the type the selection is read as.
 * It also carries the `PathInfo` of the field being planned. The selection is typed by the
 * field's table when it has one, so `columns: { title: true }` keeps its literal `true`.
 */
export type NestedSelectionFn<Types extends SchemaTypes, Type, Args extends InputFieldMap = {}> = (<
  Selection extends
    | boolean
    | ([QueryForTypeParam<Types, Type>] extends [never]
        ? {}
        : QueryForTypeParam<Types, Type>) = true,
>(
  selection?: NestedSelectionArg<Types, Selection, Args>,
  path?: PathSegment[],
  type?: string,
) => NestedSelectionResult<Types, Type, Selection>) &
  PathInfo;

/**
 * The selection given to `nestedSelection`: the query config itself, or a callback building it
 * from the field's arguments, the context, and the field's `PathInfo`. A schema with
 * `AsyncSelections: true` may also give a promise of the config, or an async callback; the result
 * is typed by the query either way, and is a promise at runtime only when a promise or an async
 * callback was given, or a selection beneath it is async, and must then be awaited.
 */
export type NestedSelectionArg<Types extends SchemaTypes, Selection, Args extends InputFieldMap> =
  | Selection
  | (true extends Types['AsyncSelections'] ? PromiseLike<Selection> : never)
  | ((
      args: InputShapeFromFields<Args>,
      ctx: Types['Context'],
      pathInfo: PathInfo,
    ) => MaybeAsyncSelection<Types, Selection>);

export type DrizzleFieldSelection =
  | DBQueryConfig<'one'>
  | ((
      args: {},
      ctx: object,
      mergeNestedSelection: (
        selection:
          | SelectionMap
          | boolean
          | ((args: object, context: object) => MaybePromise<DBQueryConfig<'one'>>),
        path?: IndirectInclude | PathSegment[],
        type?: string,
      ) => DBQueryConfig<'one'> | boolean,
      resolveSelection: (path: string[]) => FieldNode | null,
      pathInfo: PathInfo,
    ) => MaybePromise<SelectionMap | false | null | undefined>);

export type ExtractTable<Types extends SchemaTypes, Shape> = Shape extends {
  [drizzleTableName]?: keyof Types['DrizzleRelations'];
}
  ? Types['DrizzleRelations'][NonNullable<Shape[typeof drizzleTableName]>]
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
  'description' | 'select' | 'type' | InferredFieldOptionKeys
> & {
  description?: string | false;
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  type?: DrizzleRef<any, Table['relations'][Field]['targetTableName']>;
  query?: QueryForField<Types, Args, Table['relations'][Field]>;
};

export type VariantFieldOptions<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelations'],
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
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
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
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
                Types['DrizzleRelations'],
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
  relationType: 'one';
}
  ? ObjectRef<Types, TypesForRelation<Types, Rel>>
  : [ObjectRef<Types, TypesForRelation<Types, Rel>>];

export type RelatedCountOptions<
  Types extends SchemaTypes,
  Shape,
  Args extends InputFieldMap,
  Where,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, Shape, 'Int', false, Args, number>,
  'type' | InferredFieldOptionKeys
> & {
  where?:
    | Where
    | ((
        args: InputShapeFromFields<Args>,
        context: Types['Context'],
      ) => MaybeAsyncSelection<Types, Where>);
};

/**
 * The options of `t.relatedField`: the ordinary object field options (description, deprecation,
 * extensions, and what other plugins add), with a `select` that plans a query on the relation.
 */
export type RelatedSelectionFieldOptions<
  Types extends SchemaTypes,
  TableConfig extends TableRelationalConfig,
  Type extends TypeParam<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  Select,
  ShapeWithSelection,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, ShapeWithSelection, Type, Nullable, Args, unknown>,
  InferredFieldOptionKeys
> & {
  /**
   * The query planned on the parent row for this field: `buildFilter` filters the related table
   * to the parent's rows, `nestedQuery` plans the field's own selection beneath a query. With
   * `AsyncSelections: true` the function may be async.
   */
  select: ((
    buildFilter: (parentTable: TableConfig['table']) => SQL,
    args: InputShapeFromFields<Args>,
    ctx: Types['Context'],
    nestedQuery: (
      query: DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
    ) => DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
  ) => MaybeAsyncSelection<Types, Select>) &
    CheckAsyncSelection<Types, Select>;
  resolve: (
    parent: ShapeWithSelection,
    args: InputShapeFromFields<Args>,
    ctx: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<ShapeFromTypeParam<Types, Type, Nullable>>;
};

export type TypesForRelation<Types extends SchemaTypes, Rel extends Relation> = BuildQueryResult<
  Types['DrizzleRelations'],
  Types['DrizzleRelations'][Rel['targetTableName']],
  true
>;

export type QueryForField<
  Types extends SchemaTypes,
  Args extends InputFieldMap,
  Rel extends Relation,
> = (
  Rel extends {
    relationType: 'one';
  }
    ? Omit<
        DBQueryConfig<
          'one',
          Types['DrizzleRelations'],
          Types['DrizzleRelations'][Rel['targetTableName']]
        >,
        'columns' | 'extra' | 'with'
      >
    : Omit<
        DBQueryConfig<
          'many',
          Types['DrizzleRelations'],
          Types['DrizzleRelations'][Rel['targetTableName']]
        >,
        'columns' | 'extra' | 'with'
      >
) extends infer QueryConfig
  ?
      | QueryConfig
      | ((
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          pathInfo: PathInfo,
        ) => MaybeAsyncSelection<Types, QueryConfig>)
  : never;

export type QueryForDrizzleField<
  Types extends SchemaTypes,
  Param,
  Table extends keyof Types['DrizzleRelations'],
> = DBQueryConfig<
  Param extends [unknown] ? 'one' : 'many',
  Types['DrizzleRelations'],
  Types['DrizzleRelations'][Table]
>;

export type QueryForRelatedConnection<
  Types extends SchemaTypes,
  Table extends TableRelationalConfig,
  Args,
> = Omit<
  DBQueryConfig<'many', Types['DrizzleRelations'], Table>,
  'limit' | 'offset' | 'columns' | 'extra' | 'with' | 'orderBy'
> & {
  orderBy?: ConnectionOrderBy<Table> | ((table: Table) => ConnectionOrderBy<Table>);
} extends infer QueryConfig
  ?
      | QueryConfig
      | ((
          args: Args,
          context: Types['Context'],
          pathInfo: PathInfo,
        ) => MaybeAsyncSelection<Types, QueryConfig>)
  : never;

export type QueryForDrizzleConnection<
  Types extends SchemaTypes,
  TableConfig extends TableRelationalConfig,
> = Omit<
  DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
  'limit' | 'offset' | 'orderBy'
> & {
  orderBy?: ConnectionOrderBy<TableConfig> | ((table: Table) => ConnectionOrderBy<TableConfig>);
};

export type ListRelation<T extends TableRelationalConfig> = {
  [K in keyof T['relations']]: T['relations'][K] extends Many<string> ? K : never;
}[keyof T['relations']];

export type DrizzleConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends // biome-ignore lint/suspicious/noExplicitAny: this is fine
  DrizzleRef<any, keyof Types['DrizzleRelations']> | keyof Types['DrizzleRelations'],
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
  'args' | 'type' | InferredFieldOptionKeys
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
    'type' | InferredFieldOptionKeys
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? {
        type: Type;
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        totalCount?: (
          parent: ParentShape,
          args: ConnectionArgs,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>;

        resolve: (
          query: <T = {}>(
            selection?: T & QueryForDrizzleConnection<Types, TableConfig>,
          ) => Omit<T, 'orderBy' | 'columns' | 'extra'> & {
            columns: T extends { columns: infer C extends {} } ? C : {};
            orderBy: {
              [K in TableConfig['table']['_'] extends { columns: infer Columns }
                ? keyof Columns
                : never]?: 'asc' | 'desc' | undefined;
            };
            extras: {
              $pothosQueryFor: () => SQL<TableConfig['name'] | undefined>;
            } & (T extends { extra: infer E } ? E : {});
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
  Type = unknown,
  NodeTable extends
    TableRelationalConfig = Types['DrizzleRelations'][Table['relations'][Field]['targetTableName']],
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
  'args' | 'type' | InferredFieldOptionKeys
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
    'type' | InferredFieldOptionKeys
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? {
        query?: QueryForRelatedConnection<Types, NodeTable, ConnectionArgs>;
        // biome-ignore lint/suspicious/noExplicitAny: this is fine
        type?: Type & DrizzleRef<any, Table['relations'][Field]['targetTableName']>;

        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        totalCount?: boolean;
      }
    : never);

export type ConnectionOrderBy<T extends TableRelationalConfig> =
  | Column
  | Column[]
  // keys name a column, or an extra the same query selects. `string & {}` keeps
  // the column names in autocomplete while letting extra names through
  | {
      [K in
        | (T['table']['_'] extends { columns: infer Columns } ? keyof Columns : never)
        | (string & {})]?: 'asc' | 'desc' | undefined;
    };

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

export type DrizzleConnectionShape<
  Types extends SchemaTypes,
  T,
  Parent,
  Args extends InputFieldMap,
> =
  Merge<
    ShapeFromConnection<
      PothosSchemaTypes.ConnectionShapeHelper<Types, T, false>
    > extends infer Shape
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

export { DrizzleInterfaceRef, type DrizzleRef } from './interface-ref.js';
export { DrizzleObjectRef } from './object-ref.js';
