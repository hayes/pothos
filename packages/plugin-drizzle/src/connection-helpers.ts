import {
  completeValue,
  type InputFieldMap,
  type InputShapeFromFields,
  isThenable,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import { accumulatorOf, type PathSegment } from '@pothos/selection-mapper';
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
    ) => MaybePromise<Selection>;
    query?: QueryForDrizzleConnection<Types, TableConfig> extends infer QueryConfig
      ?
          | QueryConfig
          | ((
              args: InputShapeFromFields<ExtraArgs>,
              context: Types['Context'],
            ) => MaybePromise<QueryConfig>)
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

  /** The user's `query`, a promise when its callback is async (A-7: awaited by the caller). */
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

    return (isThenable(baseQuery)
      ? baseQuery.then((resolved) => resolveList(resolved, list, args, ctx, parent))
      : resolveList(baseQuery, list, args, ctx, parent)) as unknown as {
      parent: Parent;
      edges: (Omit<EdgeShape, 'cursor' | 'node'> & { node: NodeShape; cursor: string })[];
      pageInfo: {
        startCursor: string | null;
        endCursor: string | null;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      };
    };
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
        (typeof orderBy === 'function' ? orderBy(table) : orderBy) ??
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

  function getQuery(
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    nestedSelectionOrInfo: NestedSelection | GraphQLResolveInfo,
  ) {
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
    // Both callbacks start now; the query waits for whichever of them is async (A-3, A-7: the
    // declared type stays synchronous, so an async schema awaits the result).
    const nestedSelect: MaybePromise<Record<string, unknown> | true> = select
      ? select((sel) => nestedSelection(sel as SelectionMap, ['edges', 'node']) as never, args, ctx)
      : (nestedSelection(true, ['edges', 'node']) as never);
    const baseQuery = baseQueryFor(args, ctx);

    return (isThenable(nestedSelect) || isThenable(baseQuery)
      ? Promise.all([nestedSelect, baseQuery]).then(([nested, base]) =>
          buildQuery(nested, base, args, ctx),
        )
      : buildQuery(nestedSelect, baseQuery, args, ctx)) as unknown as Omit<Selection, 'orderBy'> & {
      orderBy: {
        [K in TableConfig['table']['_'] extends { columns: infer Columns }
          ? keyof Columns
          : never]?: 'asc' | 'desc' | undefined;
      };
      where: RelationsFilter<TableConfig, Types['DrizzleRelations']>;
    };
  }

  // Built once per helper, so a synchronous `getQuery` allocates nothing beyond the query.
  function buildQuery(
    nestedSelect: Record<string, unknown> | true,
    baseQuery: BaseQuery,
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
  ) {
    const accumulator = accumulatorOf(adapter);
    const node = accumulator.create(config.relations[tableName]);

    accumulator.merge(node, getQueryArgs(args, ctx, baseQuery).select as SelectionMap);

    if (typeof nestedSelect === 'object' && nestedSelect) {
      accumulator.merge(node, nestedSelect);
    }

    return omitUndefinedKeys({
      ...baseQuery,
      ...accumulator.emit(node),
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
