import { completeValue, type MaybePromise, ObjectRef, type SchemaTypes } from '@pothos/core';
import { type IndirectInclude, selectedFieldNames } from '@pothos/selection-mapper';
import {
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLResolveInfo,
  getNamedType,
  isObjectType,
  isUnionType,
} from 'graphql';
import { PRISMA_NEXT_CONNECTION_AGGREGATE } from '../constants.js';
import type { MapperCollection } from './adapter.js';
import type { PrismaNextConfig } from './config.js';
import {
  applyCursorPagination,
  type CursorPlan,
  connectionOrder,
  cursorColumns,
  type OrderByDecl,
  validateCursorArgs,
} from './cursors.js';
import type { PrismaNextRelation } from './model.js';
import {
  COUNT_SLOT,
  computedSelection,
  EMPTY,
  type PrismaNextSelection,
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

/** The options `connectionSettings` reads, as each kind of connection takes them. */
export interface ConnectionSettingsOptions {
  defaultSize?: SizeOption;
  maxSize?: SizeOption;
  totalCount?: boolean | TotalCountCallback;
  orderBy?: OrderByDecl | ((args: never, ctx: never) => OrderByDecl | undefined);
  query?: unknown;
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

/** The node type of the connection a field returns. */
export function connectionNodeType(returnType: GraphQLOutputType): string | undefined {
  const type = connectionType(returnType);
  const edge = isObjectType(type) ? type.getFields().edges : undefined;
  const edgeType = edge && getNamedType(edge.type);
  const node = edgeType && isObjectType(edgeType) ? edgeType.getFields().node : undefined;
  return node && getNamedType(node.type).name;
}

/** The connection type beneath the errors plugin's union on a connection field's return type. */
function connectionType(returnType: GraphQLOutputType): GraphQLNamedType {
  const type = getNamedType(returnType);
  const include = type.extensions?.pothosIndirectInclude as IndirectInclude | undefined;
  if (!(include && isUnionType(type))) {
    return type;
  }
  const [segment] = include.path ?? [];
  const name = segment ? segment.type : include.getType();
  const member = type.getTypes().find((candidate) => candidate.name === name);
  return member && segment
    ? getNamedType(member.getFields()[segment.name]!.type)
    : (member ?? type);
}

/**
 * The options every kind of connection handles the same way. Page sizes fall back to the plugin's
 * defaults and, as in core, aren't validated. `totalCount` is `true`, which uses the ORM's count
 * aggregate, or a callback. `orderBy` is checked here, and its callback when a request is planned.
 */
export function connectionSettings(
  config: PrismaNextConfig,
  modelKey: string,
  { defaultSize, maxSize, totalCount, orderBy, query }: ConnectionSettingsOptions,
) {
  const orderFor = connectionOrder(config.contract, modelKey, orderBy);
  const resolveSize = (option: SizeOption | undefined, args: object, ctx: object) =>
    typeof option === 'function' ? option(args as never, ctx as never) : option;
  /**
   * What selecting `names` asks of a connection returning `returnType`: whether it needs rows, and
   * where its count comes from, `'aggregate'` or the callback. With the `totalCount` option, a field
   * named `totalCount` is the count, whether generated or user-defined, and needs no rows. Without
   * it, a user's `totalCount` is an ordinary field. Other fields need rows unless flagged as an
   * aggregate or `__typename`. Without names, any configured count is used.
   */
  function selection(
    names?: ReadonlySet<string>,
    returnType?: GraphQLOutputType,
  ): { needsRows: boolean; count: 'aggregate' | TotalCountCallback | undefined } {
    const source = totalCount === true ? 'aggregate' : totalCount || undefined;
    if (!(names && returnType)) {
      return { needsRows: true, count: source };
    }
    const type = connectionType(returnType);
    const isAggregate = (name: string) =>
      (source !== undefined && name === 'totalCount') ||
      (isObjectType(type) &&
        !!type.getFields()[name]?.extensions?.[PRISMA_NEXT_CONNECTION_AGGREGATE]);
    return {
      needsRows: [...names].some((name) => name !== '__typename' && !isAggregate(name)),
      count: names.has('totalCount') ? source : undefined,
    };
  }
  return {
    selection,
    /** `selection` as the document asks it of the field `info` resolves. */
    selectionFor(ctx: object, info: GraphQLResolveInfo | undefined) {
      return info ? selection(selectedFieldNames(ctx, info), info.returnType) : selection();
    },
    connectionOptions<T extends object>(connectionOptions: T): T {
      return totalCount ? (withTotalCount(connectionOptions) as T) : connectionOptions;
    },
    /**
     * Resolves the connection's sizes, order and `where` for one request and checks its cursors.
     * What they throw while a field is planned fails only that field (see `recordingFailures`).
     */
    plan(args: object, ctx: object): ConnectionPlan {
      const plan: CursorPlan = {
        order: orderFor(args, ctx),
        codecs: config.codecs(modelKey),
        defaultSize: resolveSize(defaultSize, args, ctx) ?? config.defaultConnectionSize,
        maxSize: resolveSize(maxSize, args, ctx) ?? config.maxConnectionSize,
      };
      validateCursorArgs(plan, args);
      const value = typeof query === 'function' ? query(args, ctx) : query;
      return { ...plan, where: (value as { where?: unknown } | undefined)?.where };
    },
  };
}

// A prebuilt connection ref can't be given new fields, so its own definition must add the field,
// by passing its options through the connection helpers' `connectionOptions`.
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
      totalCount: t.int({
        nullable: false,
        extensions: { [PRISMA_NEXT_CONNECTION_AGGREGATE]: true },
        // A missing count is an error rather than 0. Only the connection helpers can leave it out:
        // `wrap` without one, or `resolve` without the parent its field was given.
        resolve: (parent) => {
          if (parent.totalCount === undefined) {
            throw new Error(
              "totalCount has no count. Pass one to the connection helpers' wrap, as in wrap(rows, await totalCountPromise), or pass resolve the parent its field was given.",
            );
          }
          return parent.totalCount;
        },
      }),
      ...(userFields ? userFields(t) : {}),
    }),
  };
}

/** A connection's paging for one request. */
export type ConnectionPlan = CursorPlan & { where: unknown };

/**
 * The selection of one page of to-many relation `name` for the consumer at `scope`: the page's
 * rows, planned by `rows` from a seed that pages them, and the relation's count in the consumer's
 * `COUNT_SLOT`. `identity` identifies the load, so consumers with equal ones share it.
 */
export function pageSelection(
  relation: PrismaNextRelation,
  name: string,
  scope: string,
  {
    plan,
    args,
    identity,
    variant,
    count,
    rows,
  }: {
    plan: ConnectionPlan;
    args: object;
    identity: unknown;
    variant: string | undefined;
    count?: { filtered: boolean };
    rows?: (seed: PrismaNextSelection) => MaybePromise<PrismaNextSelection>;
  },
): MaybePromise<PrismaNextSelection> {
  const filter = (rel: MapperCollection) =>
    plan.where === undefined ? rel : rel.where(plan.where);
  const narrow = (rel: MapperCollection) => (variant === undefined ? rel : rel.variant(variant));
  const counted = count
    ? computedSelection(name, scope, identity, (sub) => ({
        [COUNT_SLOT]: (count.filtered ? filter(narrow(sub)) : narrow(sub)).count(),
      }))
    : EMPTY;
  if (!rows) {
    return counted;
  }
  const page = (rel: MapperCollection) =>
    applyCursorPagination(filter(rel), plan, args as PothosSchemaTypes.DefaultConnectionArguments);
  const seed: PrismaNextSelection = {
    columns: cursorColumns(plan.order),
    args: relationArgs(relation, { loadIdentity: identity, refine: page, variant }),
  };
  return completeValue(rowsSelection(relation, name, scope, rows(seed)), (loaded) => ({
    ...loaded,
    ...counted,
  }));
}

/** Counts the collection's rows. A synchronous throw becomes a rejection. */
export function aggregateCount(collection: unknown): Promise<number> {
  return Promise.resolve().then(() =>
    (
      collection as {
        aggregate: (
          fn: (a: { count: () => unknown }) => Record<string, unknown>,
        ) => Promise<Record<string, number>>;
      }
    )
      .aggregate((a) => ({ total: a.count() }))
      .then((r) => r.total),
  );
}
