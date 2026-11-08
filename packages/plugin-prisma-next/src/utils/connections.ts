import { completeValue, type MaybePromise, ObjectRef, type SchemaTypes } from '@pothos/core';
import { type IndirectInclude, selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { MapperCollection, PlannedQuery } from './adapter.js';
import { refSelection, relationArgs, relationLoad } from './compile-select.js';
import type { PrismaNextConfig } from './config.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  type CursorPlan,
  connectionOrder,
  cursorColumns,
  hasCursorValues,
  type OrderByDecl,
  readPage,
  withCursorValues,
} from './cursors.js';
import { checkReturned } from './errors.js';
import { type FieldLoads, keyOf, type LoadRef, ownLoads, queryLoad, refOf } from './loads.js';
import type { PrismaNextModel, PrismaNextRelation } from './model.js';
import { readOwn } from './rows.js';
import { COMPUTE, EMPTY, type PrismaNextSelection } from './selections.js';

type SizeOption = number | ((args: never, ctx: never) => number);

/** A connection's `totalCount` callback, which the plugin calls with the field's arguments. */
type TotalCountCallback = (
  parent: unknown,
  args: unknown,
  ctx: unknown,
  info: GraphQLResolveInfo,
) => MaybePromise<number>;

/** The options `connectionPaging` reads, as each kind of connection takes them. */
export interface ConnectionSettingsOptions {
  defaultSize?: SizeOption;
  maxSize?: SizeOption;
  totalCount?: boolean | TotalCountCallback;
  query?: ConnectionQuery | ((args: never, ctx: never) => ConnectionQuery | undefined);
}

/** What a connection's `query` returns. */
interface ConnectionQuery {
  where?: unknown;
  orderBy?: OrderByDecl;
}

/** Where a connection's nodes sit in its selection. */
export const CONNECTION_NODE_PATHS: string[][] = [['edges', 'node'], ['nodes']];

/** Where the nodes of a connection whose node type is `typeName` sit in its selection. */
export function connectionNodes(typeName: string): IndirectInclude {
  return {
    getType: () => typeName,
    paths: CONNECTION_NODE_PATHS.map((path) => path.map((segment) => ({ name: segment }))),
  };
}

/** A connection's paging for one request. */
type ConnectionPlan = CursorPlan & { where: unknown };

/** How a page of a to-many relation loads, beside its plan and count. */
interface PageLoad {
  variant: string | undefined;
  /** Whether the count applies the connection's `where`. */
  filtered: boolean;
  /**
   * Plans the page's rows from a seed that pages them, with the loads a connection helper's
   * `select` writes on them.
   */
  rows: (
    seed: PrismaNextSelection,
  ) => MaybePromise<{ selection: PrismaNextSelection; beneath?: FieldLoads }>;
}

/**
 * The paging every kind of connection shares: `t.prismaConnection` pages its `collection`, or
 * the type's, and `t.relatedConnection` and the connection helpers page a to-many relation in the
 * parent's statement. Page sizes fall back to the plugin's defaults and, as in core, aren't
 * validated. `totalCount` is `true`, which uses the ORM's count aggregate, or a callback. A literal
 * `query` is checked here, and a callback's result when a request is planned.
 */
export function connectionPaging(
  config: PrismaNextConfig,
  modelKey: string,
  { defaultSize, maxSize, totalCount, query }: ConnectionSettingsOptions,
) {
  const orderFor = connectionOrder(config.context, modelKey);
  const resolveQuery = (value: ConnectionQuery | undefined) => ({
    where: value?.where,
    order: orderFor(value?.orderBy),
  });
  const literal = typeof query === 'function' ? undefined : resolveQuery(query);
  const resolveSize = (option: SizeOption | undefined, args: object, ctx: object) =>
    typeof option === 'function' ? option(args as never, ctx as never) : option;
  const countSource = totalCount === true ? 'aggregate' : totalCount || undefined;

  /**
   * What selecting `names` asks of a connection: whether it needs rows, and where its count comes
   * from, `'aggregate'` or the callback. With the `totalCount` option, a field named `totalCount`
   * is the count, whether generated or user-defined, and needs no rows. Without it, a user's
   * `totalCount` is an ordinary field. Other fields need rows, except `__typename`.
   */
  function selection(names: ReadonlySet<string>): {
    needsRows: boolean;
    count: 'aggregate' | TotalCountCallback | undefined;
  } {
    return {
      needsRows: [...names].some(
        (name) => name !== '__typename' && !(countSource !== undefined && name === 'totalCount'),
      ),
      count: names.has('totalCount') ? countSource : undefined,
    };
  }

  /**
   * Resolves the connection's sizes, order and `where` for one request, which page a list of rows.
   * The cursors' values are left out: only loading the page reads them.
   */
  function pagingPlan(args: object, ctx: object): ConnectionPlan {
    const { where, order } =
      literal ??
      checkReturned(
        (query as (args: object, ctx: object) => ConnectionQuery | undefined)(args, ctx),
        resolveQuery,
      );
    return {
      order,
      codecs: config.codecs(modelKey),
      defaultSize: resolveSize(defaultSize, args, ctx) ?? config.defaultConnectionSize,
      maxSize: resolveSize(maxSize, args, ctx) ?? config.maxConnectionSize,
      where,
    };
  }

  /** Resolves the connection's sizes, order, cursors and `where` for one request. */
  function plan(args: object, ctx: object): ConnectionPlan {
    return withCursorValues(pagingPlan(args, ctx), args);
  }

  return {
    pagingPlan,
    /** Adds the generated `totalCount` field to a connection's options. */
    connectionOptions<T extends object>(connectionOptions: T): T {
      return totalCount ? (withTotalCount(connectionOptions) as T) : connectionOptions;
    },

    /**
     * Plans one page of to-many relation `name` of `model`'s rows, whose connection selects
     * `selected`: its rows unless the count alone is selected, and the count when it is selected
     * and comes from the aggregate. The rows are identified by the page they load, so pages of the
     * relation planned alike share them, and the count as `relationCount`'s is, so it shares one
     * with an equal count. A query callback builds a callback `where` anew on every call, which is
     * identified by the arguments other than paging, so pages that differ only in paging share a
     * count.
     */
    planPage(
      ctx: object,
      model: PrismaNextModel,
      relation: PrismaNextRelation,
      name: string,
      selected: () => ReadonlySet<string>,
      args: object,
      { variant, filtered, rows }: PageLoad,
    ): MaybePromise<{
      selection: PrismaNextSelection;
      rows: LoadRef;
      count?: LoadRef;
      plan: ConnectionPlan;
    }> {
      const planned = plan(args, ctx);
      const { first, last, after, before, ...filterArgs } =
        args as PothosSchemaTypes.DefaultConnectionArguments;
      const where = relationLoad(config.contract, modelKey, { where: planned.where }).query;
      const built =
        typeof query === 'function' ? () => ({ fn: query, args: filterArgs }) : undefined;
      const { needsRows, count } = selection(selected());
      const filter = (rel: MapperCollection) =>
        planned.where === undefined ? rel : rel.where(planned.where);
      const narrow = (rel: MapperCollection) =>
        variant === undefined ? rel : rel.variant(variant);
      // Both are referenced even when unselected, since another field node of the connection's
      // response key, whose position the resolver may not read, may select them.
      const countLoad = refOf(
        config,
        ctx,
        model,
        queryLoad('count', name, variant, filtered ? where : undefined, built),
      );
      const countRef =
        countSource !== 'aggregate'
          ? undefined
          : count === 'aggregate'
            ? countLoad
            : { ...countLoad, unplanned: true as const };
      const counted: PrismaNextSelection =
        count === 'aggregate'
          ? {
              computed: {
                [keyOf(countLoad)]: {
                  kind: 'count',
                  [COMPUTE]: (sub) => countOf(filtered ? filter(narrow(sub)) : narrow(sub)),
                },
              },
            }
          : EMPTY;
      const { order, defaultSize, maxSize } = planned;
      const rowsRef = refOf(config, ctx, model, {
        ...queryLoad('rows', name, variant, where, built),
        page: { order, defaultSize, maxSize, first, last, after, before },
      });
      if (!needsRows) {
        return {
          selection: counted,
          rows: { ...rowsRef, unplanned: true },
          count: countRef,
          plan: planned,
        };
      }
      const page = (rel: MapperCollection) =>
        applyCursorPagination(
          filter(rel),
          planned,
          args as PothosSchemaTypes.DefaultConnectionArguments,
        );
      const seed: PrismaNextSelection = {
        columns: cursorColumns(planned.order),
        args: {
          ...relationArgs(relation, { refine: page, variant }),
          ...(hasCursorValues(planned) ? { cursors: true } : {}),
        },
      };
      return completeValue(rows(seed), ({ selection: loaded, beneath }) => ({
        selection: { ...refSelection(rowsRef, loaded).selection, ...counted },
        rows: beneath ? { ...rowsRef, beneath } : rowsRef,
        count: countRef,
        plan: planned,
      }));
    },

    /**
     * Loads one page of `collection`, a root connection's, filtered by `query`: its rows, with the
     * selection `applySelection` applies from a seed holding the cursor columns, unless the count
     * alone is selected, and its count when it is selected.
     */
    async loadPage(
      collection: MapperCollection,
      parent: unknown,
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      info: GraphQLResolveInfo,
      applySelection: (
        paged: MapperCollection,
        seed: PrismaNextSelection,
      ) => MaybePromise<PlannedQuery>,
    ) {
      const planned = plan(args, ctx);
      const { needsRows, count } = selection(selectedFieldNames(ctx, info));
      const filtered = planned.where === undefined ? collection : collection.where(planned.where);
      // Runs for a count-only selection too, so the collection is still checked. No rows are
      // fetched here.
      const paged = applyCursorPagination(filtered, planned, args);
      const rowsPromise = needsRows
        ? Promise.resolve(applySelection(paged, { columns: cursorColumns(planned.order) })).then(
            ({ query, cursors }) =>
              readPage(
                (query as unknown as { all(): Promise<Record<string, unknown>[]> }).all(),
                hasCursorValues(planned) || cursors,
              ),
          )
        : Promise.resolve([]);
      // Counts the collection, filtered by `query`, before pagination.
      const countPromise =
        count === 'aggregate'
          ? aggregateCount(filtered)
          : Promise.resolve().then(() => count?.(parent, args, ctx, info));
      // Promise.all handles both rejections, so a later one isn't left unhandled.
      const [rows, totalCount] = await Promise.all([rowsPromise, countPromise]);
      return { rows, plan: planned, totalCount };
    },

    /**
     * The page `t.relatedConnection` planned with `planPage` for the field `info` resolves on
     * `parent`. The count comes with the rows, or from the `totalCount` callback when it is
     * selected.
     */
    async relationPage(
      parent: object,
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      info: GraphQLResolveInfo,
    ) {
      const { count } = selection(selectedFieldNames(ctx, info));
      const rows = (readOwn(info, parent, 'rows') ?? []) as Record<string, unknown>[];
      const totalCount =
        count === 'aggregate'
          ? (readOwn(info, parent, 'count') as number)
          : await count?.(parent, args, ctx, info);
      // The gate records what the field planned before it resolves.
      const { plan: planned } = ownLoads(info.path)!;
      return buildConnectionPage(rows, planned as ConnectionPlan, args, { totalCount, parent });
    },
  };
}

// A prebuilt connection ref can't be given new fields, so its own definition must add the field.
function withTotalCount(connectionOptions: object): object {
  if (connectionOptions instanceof ObjectRef) {
    return connectionOptions;
  }
  const userFields = (connectionOptions as { fields?: (t: unknown) => Record<string, unknown> })
    .fields;
  return {
    ...connectionOptions,
    fields: (
      t: PothosSchemaTypes.ObjectFieldBuilder<SchemaTypes, { totalCount?: number }>,
    ): Record<string, unknown> => ({
      totalCount: t.int({ nullable: false, resolve: (parent) => parent.totalCount! }),
      ...(userFields ? userFields(t) : {}),
    }),
  };
}

/** `collection`'s count. The types reject counts on a target without aggregates, such as MySQL. */
export function countOf(collection: object): unknown {
  return (collection as { count(): unknown }).count();
}

/** Counts the collection's rows. A synchronous throw becomes a rejection. */
function aggregateCount(collection: unknown): Promise<number> {
  return Promise.resolve().then(() =>
    (
      collection as {
        aggregate: (fn: (a: object) => Record<string, unknown>) => Promise<Record<string, number>>;
      }
    )
      .aggregate((a) => ({ total: countOf(a) }))
      .then((r) => r.total),
  );
}
