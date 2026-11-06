import {
  completeValue,
  type MaybePromise,
  ObjectRef,
  PothosSchemaError,
  type SchemaTypes,
} from '@pothos/core';
import { type IndirectInclude, selectedFieldNames } from '@pothos/selection-mapper';
import {
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLResolveInfo,
  getNamedType,
  isObjectType,
  isUnionType,
} from 'graphql';
import type { MapperCollection } from './adapter.js';
import type { PrismaNextConfig } from './config.js';
import {
  applyCursorPagination,
  type CursorPlan,
  connectionOrder,
  cursorColumns,
  type OrderByDecl,
  withCursorValues,
} from './cursors.js';
import { InternalError } from './errors.js';
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
 * aggregate, or a callback. A literal `query` is checked here, and a callback's result when a request
 * is planned.
 */
export function connectionSettings(
  config: PrismaNextConfig,
  modelKey: string,
  { defaultSize, maxSize, totalCount, query }: ConnectionSettingsOptions,
) {
  const orderFor = connectionOrder(config.context, modelKey);
  const resolveQuery = (value: ConnectionQuery | undefined, ErrorClass: typeof InternalError) => ({
    where: value?.where,
    order: orderFor(value?.orderBy, ErrorClass),
  });
  const literal = typeof query === 'function' ? undefined : resolveQuery(query, PothosSchemaError);
  const resolveSize = (option: SizeOption | undefined, args: object, ctx: object) =>
    typeof option === 'function' ? option(args as never, ctx as never) : option;
  /**
   * What selecting `names` asks of a connection: whether it needs rows, and where its count comes
   * from, `'aggregate'` or the callback. With the `totalCount` option, a field named `totalCount`
   * is the count, whether generated or user-defined, and needs no rows. Without it, a user's
   * `totalCount` is an ordinary field. Other fields need rows, except `__typename`. Without names,
   * any configured count is used.
   */
  function selection(names?: ReadonlySet<string>): {
    needsRows: boolean;
    count: 'aggregate' | TotalCountCallback | undefined;
  } {
    const source = totalCount === true ? 'aggregate' : totalCount || undefined;
    if (!names) {
      return { needsRows: true, count: source };
    }
    return {
      needsRows: [...names].some(
        (name) => name !== '__typename' && !(source !== undefined && name === 'totalCount'),
      ),
      count: names.has('totalCount') ? source : undefined,
    };
  }
  return {
    selection,
    /** `selection` as the document asks it of the field `info` resolves. */
    selectionFor(ctx: object, info: GraphQLResolveInfo | undefined) {
      return selection(info && selectedFieldNames(ctx, info));
    },
    connectionOptions<T extends object>(connectionOptions: T): T {
      return totalCount ? (withTotalCount(connectionOptions) as T) : connectionOptions;
    },
    /** Resolves the connection's sizes, order, cursors and `where` for one request. */
    plan(args: object, ctx: object): ConnectionPlan {
      const { where, order } =
        literal ??
        resolveQuery(
          (query as (args: object, ctx: object) => ConnectionQuery | undefined)(args, ctx),
          InternalError,
        );
      const plan = withCursorValues(
        {
          order,
          codecs: config.codecs(modelKey),
          defaultSize: resolveSize(defaultSize, args, ctx) ?? config.defaultConnectionSize,
          maxSize: resolveSize(maxSize, args, ctx) ?? config.maxConnectionSize,
        },
        args,
      );
      return { ...plan, where };
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
      // The connection helpers' `wrap` without a count leaves it out, which fails the field.
      totalCount: t.int({ nullable: false, resolve: (parent) => parent.totalCount! }),
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
        [COUNT_SLOT]: countOf(count.filtered ? filter(narrow(sub)) : narrow(sub)),
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
