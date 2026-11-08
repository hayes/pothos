import { completeValue, type MaybePromise, ObjectRef, type SchemaTypes } from '@pothos/core';
import { type IndirectInclude, selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { MapperCollection } from './adapter.js';
import { relationArgs, relationLoad } from './compile-select.js';
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
import { type FieldLoads, keyOf, type LoadRef, ownRef, queryLoad, refOf } from './loads.js';
import { initialSelection } from './map-query.js';
import { getModel, type PrismaNextModel, type PrismaNextRelation } from './model.js';
import { PAGE, type PageData, parseRow, readLoad, viewOf } from './rows.js';
import { appliesCursors, COMPUTE, type PrismaNextSelection } from './selections.js';

type SizeOption = number | ((args: never, ctx: never) => number);

type TotalCountCallback = (
  parent: unknown,
  args: unknown,
  ctx: unknown,
  info: GraphQLResolveInfo,
) => MaybePromise<number>;

export interface ConnectionSettingsOptions {
  defaultSize?: SizeOption;
  maxSize?: SizeOption;
  totalCount?: boolean | TotalCountCallback;
  query?: ConnectionQuery | ((args: never, ctx: never) => ConnectionQuery | undefined);
}

interface ConnectionQuery {
  where?: unknown;
  orderBy?: OrderByDecl;
}

type ConnectionArgs = PothosSchemaTypes.DefaultConnectionArguments;
type Rows = Record<string, unknown>[];

type PageRows = (
  seed: PrismaNextSelection,
) => MaybePromise<{ selection: PrismaNextSelection; beneath?: FieldLoads }>;

export const CONNECTION_NODE_PATHS: string[][] = [['edges', 'node'], ['nodes']];

export function connectionNodes(typeName: string): IndirectInclude {
  return {
    getType: () => typeName,
    paths: CONNECTION_NODE_PATHS.map((path) => path.map((segment) => ({ name: segment }))),
  };
}

type ConnectionPlan = CursorPlan & { where: unknown };

/**
 * The paging every kind of connection shares. Root connections page a collection in a statement
 * of their own; related ones page a to-many relation in the parent's. As in core, page sizes
 * aren't validated.
 */
export function connectionPaging(
  config: PrismaNextConfig,
  modelKey: string,
  { defaultSize, maxSize, totalCount, query }: ConnectionSettingsOptions,
) {
  const model = getModel(config.contract, modelKey);
  const orderFor = connectionOrder(config.context, modelKey);
  const resolveQuery = (value: ConnectionQuery | undefined) => ({
    where: value?.where,
    order: orderFor(value?.orderBy),
  });
  const literal = typeof query === 'function' ? undefined : resolveQuery(query);
  const resolveSize = (option: SizeOption | undefined, args: object, ctx: object) =>
    typeof option === 'function' ? option(args as never, ctx as never) : option;
  const countSource: 'aggregate' | TotalCountCallback | undefined =
    totalCount === true ? 'aggregate' : totalCount || undefined;

  /**
   * With the `totalCount` option, a field named `totalCount` (generated or user-defined) is the
   * count and needs no rows. Without it, a user's `totalCount` is an ordinary field.
   */
  const needs = (names: ReadonlySet<string>) => ({
    rows: [...names].some(
      (name) => name !== '__typename' && !(countSource !== undefined && name === 'totalCount'),
    ),
    count: names.has('totalCount') ? countSource : undefined,
  });

  /** Without the cursors' values: only loading the page reads them. */
  function plan(args: object, ctx: object): ConnectionPlan {
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

  return {
    connectionOptions<T extends object>(connectionOptions: T): T {
      return totalCount ? (withTotalCount(connectionOptions) as T) : connectionOptions;
    },

    /**
     * Pages planned alike share their rows. A query callback builds its `where` anew on every
     * call, so it is identified by the non-paging arguments, and pages differing only in paging
     * share a count.
     */
    pageLoads(
      ctx: object,
      owner: PrismaNextModel,
      relation: PrismaNextRelation,
      name: string,
      args: object,
      names: ReadonlySet<string>,
      { variant, filtered, rows }: { variant?: string; filtered: boolean; rows: PageRows },
    ): MaybePromise<{ selection: PrismaNextSelection; ref: LoadRef }> {
      const planned = withCursorValues(plan(args, ctx), args);
      const { first, last, after, before, ...filterArgs } = args as ConnectionArgs;
      const where = relationLoad(config.contract, modelKey, { where: planned.where }).query;
      const built =
        typeof query === 'function' ? () => ({ fn: query, args: filterArgs }) : undefined;
      const needed = needs(names);
      const filter = (rel: MapperCollection) =>
        planned.where === undefined ? rel : rel.where(planned.where);
      const narrow = (rel: MapperCollection) =>
        variant === undefined ? rel : rel.variant(variant);
      // Another field node of the same response key may plan what this one doesn't.
      const optional = (ref: LoadRef, plans: boolean): LoadRef =>
        plans ? ref : { ...ref, unplanned: true };
      const count = refOf(
        config,
        ctx,
        owner,
        queryLoad('count', name, variant, filtered ? where : undefined, built),
      );
      const { order, defaultSize, maxSize } = planned;
      const ref: LoadRef = optional(
        {
          ...refOf(config, ctx, owner, {
            ...queryLoad('rows', name, variant, where, built),
            page: { order, defaultSize, maxSize, first, last, after, before },
          }),
          ...(countSource === 'aggregate'
            ? { count: optional(count, needed.count === 'aggregate') }
            : {}),
        },
        needed.rows,
      );
      const counted: PrismaNextSelection =
        needed.count === 'aggregate'
          ? {
              computed: {
                [keyOf(count)]: {
                  kind: 'count',
                  [COMPUTE]: (sub) => countOf(filtered ? filter(narrow(sub)) : narrow(sub)),
                },
              },
            }
          : {};
      if (!needed.rows) {
        return { selection: counted, ref };
      }
      const seed: PrismaNextSelection = {
        columns: cursorColumns(planned.order),
        args: {
          ...relationArgs(relation, {
            refine: (rel) => applyCursorPagination(filter(rel), planned, args),
            variant,
          }),
          ...(hasCursorValues(planned) ? { cursors: true } : {}),
        },
      };
      return completeValue(rows(seed), ({ selection, beneath }) => ({
        selection: { relations: { [keyOf(ref)]: selection }, ...counted },
        ref: beneath ? { ...ref, beneath } : ref,
      }));
    },

    async rootPage(
      collection: MapperCollection,
      parent: unknown,
      args: ConnectionArgs,
      ctx: object,
      info: GraphQLResolveInfo,
      rows: PageRows,
    ) {
      const planned = withCursorValues(plan(args, ctx), args);
      const { rows: needsRows, count } = needs(selectedFieldNames(ctx, info));
      const filtered = planned.where === undefined ? collection : collection.where(planned.where);
      // Paged for a count-only selection too, so the collection is still checked.
      const paged = applyCursorPagination(filtered, planned, args);
      const loadRows = async () => {
        const seed = { columns: cursorColumns(planned.order) };
        const { selection, beneath } = await rows(
          initialSelection(config.contract, modelKey, seed),
        );
        const query = config.adapter.emit(paged, selection, model) as unknown as {
          all(): Promise<Rows>;
        };
        const loaded = await readPage(
          query.all(),
          hasCursorValues(planned) || appliesCursors(selection),
        );
        return beneath?.view ? loaded.map((row) => viewOf(parseRow(row, model), beneath)) : loaded;
      };
      // Promise.all handles both rejections, so a later one isn't left unhandled.
      const [loaded, totalCount] = await Promise.all([
        needsRows ? loadRows() : [],
        count === 'aggregate'
          ? aggregateCount(filtered)
          : Promise.resolve().then(() => count?.(parent, args, ctx, info)),
      ]);
      return { rows: loaded as Rows, totalCount, plan: planned };
    },

    /** The page `t.relatedConnection` planned with `pageLoads`. */
    async ownPage(parent: object, args: ConnectionArgs, ctx: object, info: GraphQLResolveInfo) {
      const { count } = needs(selectedFieldNames(ctx, info));
      const ref = ownRef(info)!;
      const totalCount =
        count === 'aggregate'
          ? (readLoad(parent, ref.count!) as number)
          : await count?.(parent, args, ctx, info);
      const { order, defaultSize, maxSize } = ref.load.page as CursorPlan;
      const paged = { order, defaultSize, maxSize, codecs: config.codecs(modelKey) };
      return buildConnectionPage((readLoad(parent, ref) ?? []) as Rows, paged, args, {
        totalCount,
        parent,
      });
    },

    page(
      rows: readonly Record<string, unknown>[],
      args: ConnectionArgs,
      ctx: object,
      { parent, totalCount }: { parent?: unknown; totalCount?: number },
    ) {
      // Only the list `getQuery` or `load` loaded carries its count.
      return buildConnectionPage(rows, plan(args, ctx), args, {
        totalCount: totalCount ?? (rows as { [PAGE]?: PageData })[PAGE]?.count,
        parent,
      });
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

/** The types reject counts on a target without aggregates, such as MySQL. */
export function countOf(collection: object): unknown {
  return (collection as { count(): unknown }).count();
}

/** A synchronous throw becomes a rejection. */
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
