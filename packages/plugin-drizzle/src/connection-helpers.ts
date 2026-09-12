import {
  completeValue,
  type InputFieldMap,
  type InputShapeFromFields,
  isThenable,
  type MaybeAsyncSelection,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import type { PathSegment } from '@pothos/selection-mapper';
import type {
  BuildQueryResult,
  DBQueryConfig,
  RelationsFilter,
  SQL,
  TableRelationalConfig,
} from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import type { DrizzleRef } from './interface-ref.js';
import type { QueryForDrizzleConnection } from './types.js';
import { drizzleAdapter } from './utils/adapter.js';
import { checkAwaitSelections } from './utils/await-selections.js';
import { getSchemaConfig } from './utils/config.js';
import {
  type DrizzleCursorConnectionQueryOptions,
  drizzleCursorConnectionQuery,
  getCursorFormatter,
  wrapConnectionResult,
} from './utils/cursors.js';
import { queryFromInfo } from './utils/map-query.js';
import { getRefFromModel } from './utils/refs.js';
import { omitUndefinedKeys, type SelectionMap } from './utils/selections.js';

export function drizzleConnectionHelpers<
  Types extends SchemaTypes,
  Type extends DrizzleRef<Types> | keyof Types['DrizzleRelations'],
  Selection extends DBQueryConfig<'one', Types['DrizzleRelations'], TableConfig> | true,
  TableConfig extends TableRelationalConfig = Types['DrizzleRelations'][Type extends DrizzleRef<
    Types,
    infer T
  >
    ? T
    : Type],
  Shape = Type extends DrizzleRef<
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    any,
    keyof Types['DrizzleRelations'],
    infer S
  >
    ? S
    : BuildQueryResult<Types['DrizzleRelations'], TableConfig, true>,
  EdgeShape = true extends Selection
    ? Shape
    : BuildQueryResult<Types['DrizzleRelations'], TableConfig, Selection>,
  NodeShape = EdgeShape,
  ExtraArgs extends InputFieldMap = {},
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrType: Type,
  {
    select,
    resolveNode,
    query,
    args: createArgs,
    maxSize = builder.options.drizzle?.maxConnectionSize,
    defaultSize = builder.options.drizzle?.defaultConnectionSize,
  }: {
    args?: (t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => ExtraArgs;
    select?: (
      // The node's selection: its table is the connection field's, which the helper does not know.
      nestedSelection: <T extends true | {}>(selection?: T) => T,
      args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
      ctx: Types['Context'],
    ) => MaybeAsyncSelection<Types, Selection>;
    query?: QueryForDrizzleConnection<Types, TableConfig> extends infer QueryConfig
      ?
          | QueryConfig
          | ((
              args: InputShapeFromFields<ExtraArgs>,
              context: Types['Context'],
            ) => MaybeAsyncSelection<Types, QueryConfig>)
      : never;
    defaultSize?:
      | number
      | ((
          args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    maxSize?:
      | number
      | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) => number);
    resolveNode?: (edge: EdgeShape) => NodeShape;
  } = {},
) {
  const config = getSchemaConfig(builder);
  const adapter = drizzleAdapter(config);
  const tableName =
    typeof refOrType === 'string'
      ? refOrType
      : (refOrType as DrizzleRef<Types, Type extends DrizzleRef<Types, infer T> ? T : Type>)
          .tableName;

  interface BaseQuery {
    limit?: number;
    orderBy?: unknown;
    where?: SQL;
    columns?: Record<string, boolean>;
    extras?: DrizzleCursorConnectionQueryOptions['extras'];
  }

  /** The user's `query`, a promise when its callback is async, which the caller awaits. */
  const baseQueryFor = (
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
  ): MaybePromise<BaseQuery> =>
    completeValue(
      (typeof query === 'function' ? query(args, ctx) : query) as MaybePromise<
        BaseQuery | null | undefined
      >,
      orEmpty,
    );

  // Built once per helper, so a synchronous `resolve` allocates nothing beyond the connection.
  const resolveList = (
    baseQuery: BaseQuery,
    list: (EdgeShape & {})[],
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    parent: unknown,
  ) => {
    const { select, cursorFields } = getQueryArgs(args, ctx, baseQuery);
    const formatCursor = getCursorFormatter(cursorFields, config);

    return wrapConnectionResult(
      list,
      args,
      select.limit,
      formatCursor,
      (resolveNode as never) ?? ((edge: unknown) => edge),
      parent,
    );
  };

  function resolve<Parent = undefined>(
    list: (EdgeShape & {})[],
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    parent?: Parent,
  ) {
    const baseQuery = baseQueryFor(args, ctx);

    return (
      isThenable(baseQuery)
        ? baseQuery.then((resolved) => resolveList(resolved, list, args, ctx, parent))
        : resolveList(baseQuery, list, args, ctx, parent)
    ) as MaybeAsyncSelection<
      Types,
      {
        parent: Parent;
        edges: (Omit<EdgeShape, 'cursor' | 'node'> & { node: NodeShape; cursor: string })[];
        pageInfo: {
          startCursor: string | null;
          endCursor: string | null;
          hasPreviousPage: boolean;
          hasNextPage: boolean;
        };
      }
    >;
  }

  const getQueryArgs = (
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: {},
    baseQuery: BaseQuery,
  ) => {
    const { limit, orderBy, where, ...fieldQuery } = baseQuery;
    const table = config.relations[tableName];

    const { cursorFields, columns, ...connectionQuery } = drizzleCursorConnectionQuery({
      ctx,
      maxSize,
      defaultSize: typeof defaultSize === 'function' ? defaultSize(args, ctx) : defaultSize,
      args,
      orderBy:
        (typeof orderBy === 'function' ? orderBy(table.table) : orderBy) ??
        getSchemaConfig(builder).getPrimaryKey(tableName),
      extras: (fieldQuery as { extras?: DrizzleCursorConnectionQueryOptions['extras'] }).extras,
      where,
      config,
      table,
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

  // The `nestedSelection` of the field's `select`, whatever table its type names.
  type NestedSelection = (selection?: SelectionMap | true, path?: PathSegment[]) => unknown;

  /** The drizzle query `getQuery` builds: the node selection, with the connection's own arguments. */
  type ConnectionQuery = Omit<Selection, 'orderBy'> & {
    orderBy: {
      [K in TableConfig['table']['_'] extends { columns: infer Columns } ? keyof Columns : never]?:
        | 'asc'
        | 'desc'
        | undefined;
    };
    where: RelationsFilter<TableConfig, Types['DrizzleRelations']>;
  };

  /**
   * What `getQuery` returns for a given `awaitSelections`. `[Await] extends [false]` rather than
   * `Await extends true`, so a caller passing a `boolean` variable — which infers `Await` as
   * `boolean`, neither literal — is handed the promise to deal with, rather than a synchronous
   * type it cannot rely on.
   */
  type ConnectionQueryReturn<Await extends boolean> = [Await] extends [false]
    ? ConnectionQuery
    : MaybePromise<ConnectionQuery>;

  /**
   * The connection's query, built from the helper's own `select` and `query` and the selection
   * beneath the field. Synchronous unless `awaitSelections` says otherwise: an async `select` or
   * `query`, or an async selection beneath the connection, throws rather than returning a promise
   * the declared type denies.
   */
  function getQuery<Await extends boolean = false>(
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    nestedSelectionOrInfo: NestedSelection | GraphQLResolveInfo,
    options?: {
      /** Whether the caller will await the query. */
      awaitSelections?: Await;
    },
  ): ConnectionQueryReturn<Await> {
    const nestedSelection: NestedSelection =
      typeof nestedSelectionOrInfo === 'function'
        ? nestedSelectionOrInfo
        : (select, path) =>
            queryFromInfo({
              info: nestedSelectionOrInfo,
              context: ctx,
              config,
              select: select as SelectionMap,
              path,
            });
    // Both callbacks start now; the query waits for whichever of them is async.
    const nestedSelect: MaybePromise<Record<string, unknown> | true> = select
      ? select((sel) => nestedSelection(sel as SelectionMap, ['edges', 'node']) as never, args, ctx)
      : (nestedSelection(true, ['edges', 'node']) as never);
    let baseQuery: MaybePromise<object>;

    try {
      baseQuery = baseQueryFor(args, ctx);
    } catch (error) {
      // The selection has already started. Preserve the query error while handling any
      // later rejection from the selection that this invocation can no longer consume.
      if (isThenable(nestedSelect)) {
        nestedSelect.then(
          () => {},
          () => {},
        );
      }

      throw error;
    }

    const built: MaybePromise<object> =
      isThenable(nestedSelect) || isThenable(baseQuery)
        ? Promise.all([nestedSelect, baseQuery]).then(([nested, base]) =>
            buildQuery(nested, base, args, ctx),
          )
        : buildQuery(nestedSelect, baseQuery, args, ctx);

    return checkAwaitSelections(
      built,
      options?.awaitSelections,
      'getQuery',
      `the ${String(tableName)} connection`,
    ) as ConnectionQueryReturn<Await>;
  }

  // Built once per helper, so a synchronous `getQuery` allocates nothing beyond the query.
  function buildQuery(
    nestedSelect: Record<string, unknown> | true,
    baseQuery: BaseQuery,
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
  ) {
    const node = adapter.createNode(config.relations[tableName]);

    adapter.mergeQuery(node, getQueryArgs(args, ctx, baseQuery).select as SelectionMap);

    if (typeof nestedSelect === 'object' && nestedSelect) {
      adapter.mergeQuery(node, nestedSelect);
    }

    return omitUndefinedKeys({
      ...baseQuery,
      ...adapter.toQuery(node),
    });
  }

  const getArgs = () => (createArgs ? builder.args(createArgs) : {}) as ExtraArgs;

  function orEmpty(baseQuery: BaseQuery | null | undefined): BaseQuery {
    return baseQuery ?? ({} as BaseQuery);
  }

  return {
    ref: (typeof refOrType === 'string'
      ? getRefFromModel(refOrType, builder)
      : refOrType) as DrizzleRef<Types, Type extends DrizzleRef<Types, infer T> ? T : Type, Shape>,
    resolve,
    select: select ?? {},
    getQuery,
    getArgs,
  };
}
