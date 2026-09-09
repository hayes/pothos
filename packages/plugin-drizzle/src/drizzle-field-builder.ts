import {
  type CompatibleTypes,
  completeValue,
  type ExposeNullability,
  type FieldKind,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  type InputShapeFromFields,
  type InterfaceParam,
  isThenable,
  type MaybePromise,
  type NormalizeArgs,
  ObjectRef,
  type PluginName,
  PothosSchemaError,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import { getLoaderMapping } from '@pothos/selection-mapper';
import {
  and,
  type BuildQueryResult,
  type DBQueryConfig,
  eq,
  type InferSelectModel,
  Many,
  relationsFilterToSQL,
  type SQL,
  type Table,
  type TableRelationalConfig,
  type TablesRelationalConfig,
} from 'drizzle-orm';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import type { DrizzleRef } from './interface-ref.js';
import type {
  DrizzleConnectionShape,
  ListRelation,
  PathInfo,
  RelatedConnectionOptions,
  RelatedCountOptions,
  RelatedFieldOptions,
  ShapeFromConnection,
  TypesForRelation,
  VariantFieldOptions,
} from './types.js';
import { getClient, getSchemaConfig } from './utils/config.js';
import {
  type DrizzleCursorConnectionQueryOptions,
  drizzleCursorConnectionQuery,
  getCursorFormatter,
  wrapConnectionResult,
} from './utils/cursors.js';
import { selectedFieldNames } from './utils/map-query.js';
import { getRefFromModel } from './utils/refs.js';
import type { SelectionMap } from './utils/selections.js';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

// drizzle-orm declares two parameters, but the implementation also takes the table's relations
// and the full relational config, which lets a `where` filter on related tables.
type RelationsFilterToSQL = (
  table: Table,
  filter: unknown,
  tableRelations?: TableRelationalConfig['relations'],
  tablesRelations?: TablesRelationalConfig,
) => SQL | undefined;

export class DrizzleObjectFieldBuilder<
  Types extends SchemaTypes,
  TableConfig extends TableRelationalConfig,
  Shape,
  ExposableShape = InferSelectModel<Extract<TableConfig['table'], { _: { brand: 'Table' } }>>,
> extends RootBuilder<Types, Shape, 'DrizzleObject'> {
  exposeBoolean = this.createExpose('Boolean');

  exposeFloat = this.createExpose('Float');

  exposeInt = this.createExpose('Int');

  exposeID = this.createExpose('ID');

  exposeString = this.createExpose('String');

  exposeBooleanList = this.createExpose(['Boolean']);

  exposeFloatList = this.createExpose(['Float']);

  exposeIntList = this.createExpose(['Int']);

  exposeIDList = this.createExpose(['ID']);

  exposeStringList = this.createExpose(['String']);

  table: string;

  typename: string;

  relatedConnection: 'relay' extends PluginName
    ? <
        Field extends ListRelation<TableConfig>,
        Nullable extends boolean,
        Args extends InputFieldMap,
        const ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        const EdgeInterfaces extends InterfaceParam<Types>[] = [],
        Type = unknown,
        Shape = // biome-ignore lint/suspicious/noExplicitAny: generic match
        Type extends DrizzleRef<any, any>
          ? Type['$inferType']
          : TypesForRelation<Types, TableConfig['relations'][Field]>,
      >(
        field: Field,
        ...args: NormalizeArgs<
          [
            options: RelatedConnectionOptions<
              Types,
              Shape,
              TableConfig,
              Field,
              Nullable,
              Args,
              Type
            >,
            connectionOptions:
              | ObjectRef<
                  Types,
                  ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, Shape, false>>
                >
              | PothosSchemaTypes.ConnectionObjectOptions<
                  Types,
                  ObjectRef<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>>,
                  false,
                  false,
                  DrizzleConnectionShape<
                    Types,
                    ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>,
                    Shape,
                    Args
                  >,
                  ConnectionInterfaces
                >,
            edgeOptions:
              | ObjectRef<
                  Types,
                  {
                    cursor: string;
                    node?: Shape | null | undefined;
                  }
                >
              | PothosSchemaTypes.ConnectionEdgeObjectOptions<
                  Types,
                  ObjectRef<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>>,
                  false,
                  DrizzleConnectionShape<
                    Types,
                    ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>,
                    Shape,
                    Args
                  >,
                  EdgeInterfaces
                >,
          ],
          0
        >
      ) => FieldRef<
        Types,
        ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, Shape, Nullable>>
      >
    : '@pothos/plugin-relay is required to use this method' = function relatedConnection(
    this: DrizzleObjectFieldBuilder<SchemaTypes, TableConfig, {}>,
    name: string,
    {
      maxSize = this.builder.options.drizzle?.maxConnectionSize,
      defaultSize = this.builder.options.drizzle?.defaultConnectionSize,
      query,
      extensions,
      description,
      totalCount,
      ...options
    }: {
      type?: ObjectRef<Types, unknown, unknown>;
      maxSize?: number | ((args: {}, ctx: {}) => number);
      defaultSize?: number | ((args: {}, ctx: {}) => number);
      extensions?: {};
      description?: string;
      query?: ((args: {}, ctx: {}) => {}) | {};
      totalCount?: boolean;
    } = {},
    connectionOptions = {},
    edgeOptions = {},
  ) {
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[name as string];
    const relatedTable = schemaConfig.relations[relationField.targetTableName];

    if (!relatedTable) {
      throw new PothosSchemaError(
        `Could not find relation ${name as string} on table ${this.table}`,
      );
    }

    const ref = options.type ?? getRefFromModel(relationField.targetTableName, this.builder);
    let typeName: string | undefined;

    const filterTotalCount = this.builder.options.drizzle?.filterConnectionTotalCount !== false;

    // The count for `totalCount` matches the connection's own filter: the relation columns plus
    // the `where` from the field's `query`, so the count agrees with the rows being paginated.
    const buildCountFilter = (parentTable: TableConfig['table'], where?: unknown): SQL => {
      const { sourceColumns, targetColumns } = relationField;
      const relationFilter = and(
        ...sourceColumns.map((sourceCol: { name: string }, i: number) =>
          eq(targetColumns[i], parentTable[sourceCol.name as never]),
        ),
      )!;

      if (!where || !filterTotalCount) {
        return relationFilter;
      }

      return and(
        relationFilter,
        (relationsFilterToSQL as RelationsFilterToSQL)(
          relatedTable.table as Table,
          where,
          relatedTable.relations,
          schemaConfig.relations,
        ),
      )!;
    };

    interface ConnectionFieldQuery {
      limit?: number;
      orderBy?: unknown;
      where?: SQL;
      columns?: Record<string, boolean>;
      extras?: DrizzleCursorConnectionQueryOptions['extras'];
    }

    // The field's `query` may be async, so the result is a promise when it is (A-5).
    const resolveFieldQuery = (
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: {},
      pathInfo?: import('./types').PathInfo,
    ): MaybePromise<ConnectionFieldQuery> =>
      completeValue(
        (typeof query === 'function'
          ? (
              query as (
                args: {},
                ctx: {},
                pathInfo?: import('./types').PathInfo,
              ) => MaybePromise<{} | null | undefined>
            )(args, ctx, pathInfo)
          : query) as MaybePromise<ConnectionFieldQuery | null | undefined>,
        orEmpty,
      );

    const getQuery = (
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: {},
      { limit, orderBy, where, ...fieldQuery }: ConnectionFieldQuery,
    ) => {
      const { cursorFields, columns, ...connectionQuery } = drizzleCursorConnectionQuery({
        ctx,
        maxSize,
        defaultSize,
        args,
        orderBy:
          (typeof orderBy === 'function' ? orderBy(relatedTable.table) : orderBy) ??
          getSchemaConfig(this.builder).getPrimaryKey(relationField.targetTableName),
        extras: fieldQuery.extras,
        where,
        config: schemaConfig,
        table: relatedTable,
      });

      return {
        select: {
          ...fieldQuery,
          ...connectionQuery,
          columns: {
            ...fieldQuery.columns,
            ...columns,
          },
          limit: Math.abs(limit ?? connectionQuery.limit),
        },
        cursorFields,
      };
    };

    const countKey = `_${name as string}_count`;

    // What the document asks of this connection, read the way the planner reads it (through
    // fragments, directives, and a wrapping type), so the resolve side agrees with the plan. The
    // selection is read once per request and shared by every parent row.
    const connectionSelection = (context: object, info: GraphQLResolveInfo) => {
      const selected = selectedFieldNames(context, info);
      const hasTotalCount = !!totalCount && selected.has('totalCount');
      const hasRows = selected.has('edges') || selected.has('nodes') || selected.has('pageInfo');

      return { hasTotalCount, totalCountOnly: hasTotalCount && !hasRows };
    };

    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown, path?: unknown) => { select?: object },
      getSelection: (path: string[]) => FieldNode | null,
      pathInfo: import('./types').PathInfo,
    ) => {
      typeName ??= this.builder.configStore.getTypeConfig(ref).name;

      const hasTotalCount = totalCount && !!getSelection(['totalCount']);
      const hasEdges = !!getSelection(['edges']);
      const hasNodes = !!getSelection(['nodes']);
      const hasPageInfo = !!getSelection(['pageInfo']);
      const totalCountOnly = hasTotalCount && !hasEdges && !hasNodes && !hasPageInfo;
      const fieldQuery = resolveFieldQuery(args, context, pathInfo);
      // The nested walk starts now, with a query that waits for the field's `query` when that is
      // async, so every callback beneath the connection runs in the same tick (A-3).
      const nested = totalCountOnly
        ? undefined
        : (nestedQuery(
            isThenable(fieldQuery)
              ? fieldQuery.then((resolved) => getQuery(args, context, resolved).select)
              : getQuery(args, context, fieldQuery).select,
            {
              getType: () => typeName!,
              paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
            },
          ) as MaybePromise<SelectionMap>);

      return completeValue(fieldQuery, (fieldQuery) => {
        const countSelection = {
          [countKey]: (parent: TableConfig['table']) =>
            getClient(this.builder, context).$count(
              relatedTable.table as Table,
              buildCountFilter(parent, fieldQuery.where),
            ),
        };

        if (totalCountOnly) {
          return {
            columns: {},
            with: {},
            extras: countSelection,
          };
        }

        return completeValue(nested, (nested) => ({
          columns: {},
          with: {
            [name]: nested,
          },
          extras: hasTotalCount ? countSelection : {},
        }));
      });
    };
    const fieldRef = (
      this as unknown as {
        connection: (...args: unknown[]) => FieldRef<Types, unknown>;
      }
    ).connection(
      {
        ...options,
        extensions: {
          ...extensions,
          pothosDrizzleSelect: relationSelect,
          pothosDrizzleLoaded: (
            value: Record<string, unknown>,
            info: GraphQLResolveInfo,
            context: object,
          ) => {
            const { hasTotalCount, totalCountOnly } = connectionSelection(context, info);

            return (
              (!hasTotalCount || value[countKey] !== undefined) &&
              (totalCountOnly || value[name as string] !== undefined)
            );
          },
        },
        description,
        type: ref,
        resolve: (
          parent: unknown,
          args: PothosSchemaTypes.DefaultConnectionArguments,
          context: {},
          info: GraphQLResolveInfo,
        ) => {
          const parentRecord = parent as Record<string, unknown>;
          const countValue = totalCount
            ? (parentRecord[countKey] as number | undefined)
            : undefined;

          // Only totalCount was requested: the relation was never selected, so skip the cursors.
          if (connectionSelection(context, info).totalCountOnly) {
            return {
              parent,
              args,
              totalCount: countValue,
              edges: [],
              pageInfo: {
                startCursor: null,
                endCursor: null,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            };
          }

          // The same `pathInfo` the select path planned this field with, recorded alongside its
          // loader mapping, so a `query` that branches on it pages the rows it selected.
          const pathInfo = getLoaderMapping(context, info.path, info.parentType.name)?.extra as
            | PathInfo
            | undefined;

          return completeValue(resolveFieldQuery(args, context, pathInfo), (fieldQuery) => {
            const { select, cursorFields } = getQuery(args, context, fieldQuery);

            return wrapConnectionResult(
              parentRecord[name] as readonly {}[],
              args,
              select.limit,
              getCursorFormatter(cursorFields, schemaConfig),
              undefined,
              parent,
              countValue,
            );
          });
        },
      },
      connectionOptions instanceof ObjectRef
        ? connectionOptions
        : {
            ...connectionOptions,
            fields: totalCount
              ? (
                  t: PothosSchemaTypes.ObjectFieldBuilder<SchemaTypes, { totalCount?: number }>,
                ) => ({
                  totalCount: t.int({
                    nullable: false,
                    extensions: {
                      pothosDrizzleTotalCount: true,
                    },
                    resolve: (connection) => connection.totalCount,
                  }),
                  ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
                })
              : (connectionOptions as { fields: undefined }).fields,
          },
      edgeOptions,
    );
    return fieldRef;
  } as never;

  constructor(
    typename: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    table: string,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind] = 'Object',
  ) {
    super(builder, 'DrizzleObject', graphqlKind);

    this.table = table;
    this.typename = typename;
  }

  variant<
    Variant extends DrizzleRef<Types, TableConfig['name']> | TableConfig['name'],
    Args extends InputFieldMap,
    Nullable,
    ResolveShape,
    ResolveReturn,
  >(
    variant: Variant,
    ...allArgs: NormalizeArgs<
      [
        options: VariantFieldOptions<
          Types,
          TableConfig['name'] & keyof Types['DrizzleRelations'],
          Variant,
          Args,
          Nullable,
          Shape,
          ResolveShape,
          ResolveReturn
        >,
      ]
    >
  ): FieldRef<Types, ResolveReturn, 'Object'> {
    const [{ isNull, nullable, ...options } = {} as never] = allArgs;
    const ref: DrizzleRef<Types> =
      typeof variant === 'string' ? getRefFromModel(variant, this.builder) : variant;

    const selfSelect = (
      _args: object,
      _context: object,
      nestedQuery: (query: unknown) => unknown,
    ) => nestedQuery(options.select ?? {});

    return this.field({
      ...(options as {}),
      type: ref,
      extensions: {
        ...options?.extensions,
        pothosDrizzleSelect: selfSelect,
      },
      nullable: nullable ?? !!isNull,
      resolve: isNull
        ? (parent, args, context, info) => {
            const parentIsNull = isNull(parent as never, args as never, context, info);
            if (parentIsNull) {
              if (isThenable(parentIsNull)) {
                return parentIsNull.then((resolved) => (resolved ? null : parent)) as never;
              }
              return null as never;
            }
            return parent as never;
          }
        : (parent) => parent as never,
    }) as FieldRef<Types, ResolveReturn, 'Object'>;
  }

  relation<
    Field extends keyof TableConfig['relations'],
    Nullable extends boolean,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    name: Field,
    ...allArgs: NormalizeArgs<
      [
        options: RelatedFieldOptions<
          Types,
          TableConfig,
          Field,
          Nullable,
          Args,
          ResolveReturnShape,
          Shape
        >,
      ]
    >
  ): FieldRef<Types, TypesForRelation<Types, TableConfig['relations'][Field]>, 'Object'> {
    const [options = {} as never] = allArgs;
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[name as string];
    const relatedTable = schemaConfig.relations[relationField.targetTableName];

    if (!relatedTable) {
      throw new PothosSchemaError(
        `Could not find relation ${name as string} on table ${this.table}`,
      );
    }
    const ref = options.type ?? getRefFromModel(relatedTable.name, this.builder);

    const { query = {}, extensions, ...rest } = options;

    // Built once per field: the select allocates nothing when the nested selection is sync. The
    // nested selection already carries the field's `query` (it is merged into the child first),
    // so nothing is spread over it.
    const selectRelation = (nested: unknown) => ({ columns: {}, with: { [name]: nested } });
    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown) => {},
      _resolveSelection: unknown,
      pathInfo: PathInfo,
    ) =>
      completeValue(
        nestedQuery(
          typeof query === 'function'
            ? (query as (args: {}, context: {}, pathInfo: PathInfo) => {})(args, context, pathInfo)
            : query,
        ),
        selectRelation,
      );

    return this.field({
      ...(rest as {}),
      type: relationField instanceof Many ? [ref] : ref,
      extensions: {
        ...extensions,
        pothosDrizzleSelect: relationSelect as never,
        pothosDrizzleLoaded: (value: Record<string, unknown>) =>
          value[name as string] !== undefined,
      },
      resolve: (parent: Record<string, never>) => parent[name as string],
    } as never) as never;
  }

  relatedField<
    Field extends keyof TableConfig['relations'],
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Args extends InputFieldMap,
    Select extends DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
    ShapeWithSelection = Shape &
      BuildQueryResult<Types['DrizzleRelations'], TableConfig, Select & { columns: {} }>,
  >(
    relationName: Field,
    options: {
      type: Type;
      nullable?: Nullable;
      args?: Args;
      description?: string;
      select: (
        buildFilter: (parentTable: TableConfig['table']) => SQL,
        args: Args extends InputFieldMap ? InputShapeFromFields<Args> : {},
        ctx: Types['Context'],
        nestedQuery: (
          query: DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
        ) => DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
      ) => MaybePromise<Select>;
      resolve: (
        parent: ShapeWithSelection,
        args: Args extends InputFieldMap ? InputShapeFromFields<Args> : {},
        ctx: Types['Context'],
        info: unknown,
      ) => ShapeFromTypeParam<Types, Type, Nullable>;
      extensions?: Record<string, unknown>;
    },
  ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> {
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[relationName as string];

    if (!relationField) {
      throw new PothosSchemaError(
        `Could not find relation ${relationName as string} on table ${this.table}`,
      );
    }

    const buildFilter = (parentTable: TableConfig['table']): SQL => {
      const { sourceColumns, targetColumns } = relationField;

      return and(
        ...sourceColumns.map((sourceCol, i) =>
          eq(targetColumns[i], parentTable[sourceCol.name as never]),
        ),
      )!;
    };

    const relationSelect = (
      args: object,
      context: Types['Context'],
      nestedQuery: (query: unknown) => unknown,
    ) =>
      completeValue(
        options.select(buildFilter as never, args as never, context, nestedQuery as never) as
          | MaybePromise<Select & { with?: unknown }>
          | undefined,
        pickSelection,
      );

    const { select: _select, extensions, ...fieldOptions } = options;

    return this.field({
      ...fieldOptions,
      extensions: {
        ...extensions,
        pothosDrizzleSelect: relationSelect as never,
      },
      resolve: options.resolve as never,
    } as never) as never;
  }

  relatedCount<
    Field extends keyof TableConfig['relations'],
    Args extends InputFieldMap,
    Where extends SQL | undefined,
  >(
    relationName: Field,
    ...allArgs: NormalizeArgs<[options: RelatedCountOptions<Types, Shape, Args, Where>]>
  ): FieldRef<Types, number, 'DrizzleObject'> {
    const [{ where, ...options } = {} as never] = allArgs;
    const countKey = `_${relationName as string}_count`;
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[relationName as string];
    const relatedTable = schemaConfig.relations[relationField.targetTableName];

    return this.relatedField(relationName, {
      ...options,
      type: 'Int' as never,
      nullable: false,
      extensions: {
        ...(options as { extensions?: Record<string, unknown> }).extensions,
        pothosDrizzleLoaded: (value: Record<string, unknown>) => value[countKey] !== undefined,
      },
      select: (
        buildFilter: (parent: TableConfig['table']) => SQL,
        args: object,
        ctx: Types['Context'],
      ) =>
        completeValue(
          typeof where === 'function'
            ? (where as (args: unknown, ctx: unknown) => MaybePromise<SQL | undefined>)(args, ctx)
            : where,
          (whereClause) =>
            ({
              extras: {
                [countKey]: (parent: TableConfig['table']) =>
                  getClient(this.builder, ctx).$count(
                    relatedTable.table as Table,
                    whereClause ? and(buildFilter(parent), whereClause) : buildFilter(parent),
                  ),
              },
            }) as never,
        ),
      resolve: (parent: Record<string, number>) => parent[countKey],
    } as never) as FieldRef<Types, number, 'DrizzleObject'>;
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends CompatibleTypes<Types, ExposableShape, Type, Nullable>,
  >(
    ...args: NormalizeArgs<
      [
        name: Name,
        options: ExposeNullability<Types, Type, ExposableShape, Name, Nullable> &
          Omit<
            PothosSchemaTypes.ObjectFieldOptions<
              Types,
              Shape,
              Type,
              Nullable,
              {},
              ResolveReturnShape
            >,
            'nullable' | 'select' | InferredFieldOptionKeys
          >,
      ]
    >
  ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> {
    const [name, options = {} as never] = args;

    const typeConfig = this.builder.configStore.getTypeConfig(this.typename, this.graphqlKind);
    const usingSelect = !!typeConfig.extensions?.pothosDrizzleSelect;

    return this.exposeField<Type, Nullable, never>(name as never, {
      ...options,
      extensions: {
        ...options.extensions,
        pothosDrizzleVariant: name,
        pothosDrizzleSelect: usingSelect && {
          columns: { [name as string]: true },
        },
      },
    }) as FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'>;
  }

  private createExpose<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      ResolveReturnShape,
      Name extends CompatibleTypes<
        Types,
        ExposableShape,
        Type,
        Type extends [unknown] ? { list: true; items: true } : true
      >,
    >(
      ...args: NormalizeArgs<
        [
          name: Name,
          options: ExposeNullability<Types, Type, ExposableShape, Name, Nullable> &
            Omit<
              PothosSchemaTypes.ObjectFieldOptions<
                Types,
                ExposableShape,
                Type,
                Nullable,
                {},
                ResolveReturnShape
              >,
              'nullable' | 'select' | 'type' | InferredFieldOptionKeys
            > & {
              description?: string | false;
            },
        ]
      >
    ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> => {
      const [name, options = {} as never] = args;

      return this.expose(
        name as never,
        {
          ...options,
          type,
        } as never,
      ) as never;
    };
  }
}

/** A relation `query` callback may return nothing; the connection then adds no filter. */
function orEmpty<T extends object>(query: T | null | undefined): T {
  return query ?? ({} as T);
}

/** A `relatedField` select's map, with the columns it may have left out defaulted. */
function pickSelection(selection: { columns?: {}; extras?: unknown; with?: unknown } | undefined) {
  return {
    columns: selection?.columns ?? {},
    extras: selection?.extras,
    with: selection?.with,
  };
}
