import { completeValue, type MaybePromise, ObjectRef, type SchemaTypes } from '@pothos/core';
import {
  type IndirectInclude,
  type Position,
  type SelectedFieldNode,
  selectedFieldNames,
} from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { MapperCollection } from './adapter.js';
import type { PrismaNextConfig } from './config.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  type CursorPlan,
  connectionOrder,
  cursorColumns,
  type OrderByDecl,
  withCursorValues,
} from './cursors.js';
import { checkReturned, InternalError } from './errors.js';
import type { PrismaNextRelation } from './model.js';
import {
  COUNT_SLOT,
  computedSelection,
  EMPTY,
  PAGE,
  type PageData,
  type PrismaNextSelection,
  registerPage,
  relationArgs,
  rowsSelection,
} from './selections.js';

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
export type ConnectionPlan = CursorPlan & { where: unknown };

/** The field a page is planned for. */
export interface PageField {
  /** The consumer id of the field's position (see `consumerId`). */
  id: string;
  selected: SelectedFieldNode;
  position: Position;
}

/** How a page of a to-many relation loads, beside its plan and count. */
export interface PageLoad {
  /** Identifies the load with the page's order, so consumers with equal ones share it. */
  identity: unknown;
  variant: string | undefined;
  /** Whether the count applies the connection's `where`. */
  filtered: boolean;
  /** Plans the page's rows from a seed that pages them. */
  rows: (seed: PrismaNextSelection) => MaybePromise<PrismaNextSelection>;
}

/**
 * The paging every kind of connection shares: `t.prismaConnection` pages a collection its resolver
 * returns, and `t.relatedConnection` and the connection helpers page a to-many relation in the
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

  /** Resolves the connection's sizes, order, cursors and `where` for one request. */
  function plan(args: object, ctx: object): ConnectionPlan {
    const { where, order } =
      literal ??
      checkReturned(
        (query as (args: object, ctx: object) => ConnectionQuery | undefined)(args, ctx),
        resolveQuery,
      );
    const cursorPlan = withCursorValues(
      {
        order,
        codecs: config.codecs(modelKey),
        defaultSize: resolveSize(defaultSize, args, ctx) ?? config.defaultConnectionSize,
        maxSize: resolveSize(maxSize, args, ctx) ?? config.maxConnectionSize,
      },
      args,
    );
    return { ...cursorPlan, where };
  }

  return {
    selection,
    plan,
    /** Adds the generated `totalCount` field to a connection's options. */
    connectionOptions<T extends object>(connectionOptions: T): T {
      return totalCount ? (withTotalCount(connectionOptions) as T) : connectionOptions;
    },

    /**
     * Plans one page of to-many relation `name` for `field`: its rows unless the count alone is
     * selected, and the count when it is selected and comes from the aggregate. The plan is kept
     * for the field's copy of the parent, which writes it onto the page's rows (see `fieldCopy`).
     */
    planPage(
      relation: PrismaNextRelation,
      name: string,
      { id, selected, position }: PageField,
      args: object,
      ctx: object,
      { identity, variant, filtered, rows }: PageLoad,
    ): MaybePromise<PrismaNextSelection> {
      const planned = plan(args, ctx);
      registerPage(position, name, planned);
      // The order is part of the identity, so aliases that share a load share their order.
      const loadIdentity = { identity, order: planned.order };
      const { needsRows, count } = selection(selected());
      const filter = (rel: MapperCollection) =>
        planned.where === undefined ? rel : rel.where(planned.where);
      const narrow = (rel: MapperCollection) =>
        variant === undefined ? rel : rel.variant(variant);
      const counted =
        count === 'aggregate'
          ? computedSelection(name, id, COUNT_SLOT, loadIdentity, (sub) =>
              countOf(filtered ? filter(narrow(sub)) : narrow(sub)),
            )
          : EMPTY;
      if (!needsRows) {
        return counted;
      }
      const page = (rel: MapperCollection) =>
        applyCursorPagination(
          filter(rel),
          planned,
          args as PothosSchemaTypes.DefaultConnectionArguments,
        );
      const seed: PrismaNextSelection = {
        columns: cursorColumns(planned.order),
        args: relationArgs(relation, { loadIdentity, refine: page, variant }),
      };
      return completeValue(rowsSelection(relation, name, id, rows(seed)), (loaded) => ({
        ...loaded,
        ...counted,
      }));
    },

    /**
     * The page of `rows`, a page `planPage` planned, as the field's copy of the parent holds it.
     * The count comes from them, or from the `totalCount` callback when it is selected.
     */
    async relationPage(
      rows: readonly Record<string, unknown>[],
      parent: unknown,
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      info: GraphQLResolveInfo,
    ) {
      const { count } = selection(selectedFieldNames(ctx, info));
      const page = pageOf(rows);
      const totalCount =
        count === 'aggregate' ? page.count : await count?.(parent, args, ctx, info);
      return buildConnectionPage(rows, page.plan, args, { totalCount, parent });
    },
  };
}

/** Whether `parent`, a field's copy, holds the page of relation `name` its field planned. */
export function pageLoaded(name: string) {
  return (parent: object) =>
    (parent as Record<string, { [PAGE]?: PageData } | undefined>)[name]?.[PAGE] !== undefined;
}

/**
 * What `planPage` recorded on a page's rows. Rows without it weren't loaded by a page, so the
 * field's resolver was handed something else.
 */
export function pageOf(rows: readonly unknown[]): { plan: ConnectionPlan; count?: number } {
  const page = (rows as { [PAGE]?: PageData })[PAGE];
  if (!page) {
    throw new InternalError(
      "A connection page's rows don't hold its plan: pass the rows its select loaded, as they are.",
    );
  }
  return page as { plan: ConnectionPlan; count?: number };
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
export function aggregateCount(collection: unknown): Promise<number> {
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
