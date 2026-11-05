import {
  decodeBase64,
  decodeCursorChunk,
  encodeBase64,
  encodeCursorChunk,
  encodeCursorTuple,
  PothosSchemaError,
  PothosValidationError,
  parseCursorConnectionArgs,
} from '@pothos/core';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import type { AnyExpression, OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type { AnyContract } from '../types/models.js';
import type { MapperCollection } from './adapter.js';
import type { FieldCodecs } from './codecs.js';
import { getCollectionPaginationState } from './collection-state.js';
import { resolveContractModel } from './contract.js';
import { InternalError } from './errors.js';
import { getModelIdentities, truncatedDateProblem } from './model.js';

// The subset of orm-client's `ModelAccessor` used here, without its contract generics.
interface ComparableColumn {
  eq(v: unknown): unknown;
  gt(v: unknown): unknown;
  lt(v: unknown): unknown;
  isNull(): AnyExpression;
  isNotNull(): unknown;
  asc(options?: { nulls?: 'first' | 'last' }): OrderByItem;
  desc(options?: { nulls?: 'first' | 'last' }): OrderByItem;
}

type Direction = 'asc' | 'desc';

/** A connection's `orderBy` as written: a direction per column, or `{ direction, nulls }`. */
export type OrderByDecl = Readonly<
  Record<string, Direction | { direction?: Direction; nulls?: 'first' | 'last' } | undefined>
>;

/** One column of a connection's order. Nullable columns always have a null placement. */
interface OrderColumn {
  readonly field: string;
  readonly direction: Direction;
  readonly nulls?: 'first' | 'last';
}

/**
 * The order a connection pages by: its model's contract key and the columns, with each column's
 * effective direction and null placement.
 */
interface CursorOrder {
  readonly model: string;
  readonly columns: readonly OrderColumn[];
}

export const cursorColumns = (order: CursorOrder): string[] =>
  order.columns.map(({ field }) => field);

const BYTES_CODEC = /\/(bytea|bytes|blob)@/;

/**
 * Resolves a connection's `orderBy` to the order it pages by. The model's first non-null key of
 * orderable columns is appended in the last column's direction, unless the order covers a key
 * already, so every row has its own position. A literal is checked when the schema is built, and a
 * callback's result for each request, as a computed key escapes the types.
 */
export function connectionOrder(
  contract: AnyContract,
  modelKey: string,
  orderBy: OrderByDecl | ((args: never, ctx: never) => OrderByDecl | undefined) | undefined,
): (args: object, ctx: object) => CursorOrder {
  const model = resolveContractModel(contract, modelKey)!;
  const problem = (field: string) => {
    const type = model.fields[field]?.type as { codecId?: string } | undefined;
    if (!type) {
      return `'${modelKey}.${field}' is not a field of the model`;
    }
    return type.codecId && BYTES_CODEC.test(type.codecId)
      ? `'${modelKey}.${field}' is a bytes column, which the ORM can't order`
      : truncatedDateProblem(contract, modelKey, field);
  };
  const keys = getModelIdentities(contract, modelKey) ?? [];
  const key = keys.find((columns) => columns.every((field) => !problem(field)));
  if (!key) {
    const reason = keys[0]?.map(problem).find(Boolean);
    throw new PothosSchemaError(
      `Connections of '${modelKey}' page by a non-null primary or unique key of orderable columns, which it doesn't have${reason ? `: ${reason}` : ''}.`,
    );
  }
  const resolve = (decl: OrderByDecl | undefined, ErrorClass: new (message: string) => Error) => {
    const order: OrderColumn[] = [];
    for (const [field, entry] of Object.entries(decl ?? {})) {
      if (entry === undefined) {
        continue;
      }
      const reason = problem(field);
      if (reason) {
        throw new ErrorClass(`Connection orderBy can't order by ${reason}.`);
      }
      const { direction = 'asc', nulls } = typeof entry === 'string' ? { direction: entry } : entry;
      const placement = nulls ?? (model.fields[field]!.nullable ? 'last' : undefined);
      order.push(placement ? { field, direction, nulls: placement } : { field, direction });
    }
    const named = new Set(order.map(({ field }) => field));
    if (!keys.some((columns) => columns.every((field) => named.has(field)))) {
      const direction = order[order.length - 1]?.direction ?? 'asc';
      for (const field of key.filter((field) => !named.has(field))) {
        order.push({ field, direction });
      }
    }
    return { model: modelKey, columns: order };
  };
  if (typeof orderBy === 'function') {
    return (args, ctx) => resolve(orderBy(args as never, ctx as never), InternalError);
  }
  const order = resolve(orderBy, PothosSchemaError);
  return () => order;
}

// Values are encoded in their column codec's stored form. Nulls skip the codec.
export function encodeValues(
  fields: readonly string[],
  values: readonly unknown[],
  codecs: FieldCodecs,
) {
  const encoded = values.map((value, i) =>
    value == null ? value : codecs(fields[i]!).encode(value),
  );
  return encoded.length === 1 ? encodeCursorChunk(encoded[0]) : encodeCursorTuple(encoded);
}

/** The values of `fields` in `payload`, or undefined when it doesn't hold them. */
export function decodeValues(
  fields: readonly string[],
  payload: string,
  codecs: FieldCodecs,
): Record<string, unknown> | undefined {
  let decoded: unknown;
  try {
    decoded = decodeCursorChunk(payload);
  } catch {
    return undefined;
  }
  // Checked against `fields` rather than the decoded shape, as a JSON column can hold an array.
  const values = fields.length === 1 ? [decoded] : decoded;
  if (!Array.isArray(values) || values.length !== fields.length) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  try {
    fields.forEach((field, i) => {
      out[field] = values[i] == null ? values[i] : codecs(field).decode(values[i]);
    });
  } catch {
    return undefined;
  }
  return out;
}

/**
 * Cursors have the form `PNC:<hash>:<chunk>`, and a multi-column cursor's chunk is a `T:` tuple.
 * The hash is of the order's model and, per column, its name, direction and null placement, so a
 * cursor from another model or any other order is refused rather than paging from a position that
 * means something else. It keeps column names out of the cursor and tells orders apart, and is not
 * tamper protection: the values are only base64 encoded.
 */
const CURSOR_PREFIX = 'PNC:';

// 32-bit FNV-1a. Model keys and field names are identifiers, so the separators can't collide.
function orderHash({ model, columns }: CursorOrder): string {
  const text = [
    model,
    ...columns.map(({ field, direction, nulls }) => `${field} ${direction} ${nulls ?? ''}`),
  ].join(',');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function encodeCursor(order: CursorOrder, row: Record<string, unknown>, codecs: FieldCodecs) {
  const fields = cursorColumns(order);
  const values = fields.map((field) => {
    // A missing column would encode as null and page from the wrong position.
    if (row[field] === undefined) {
      throw new InternalError(
        `Cannot encode a cursor: the row is missing cursor column '${field}'. Select the cursor columns on the paginated collection.`,
      );
    }
    return row[field];
  });
  return encodeBase64(
    `${CURSOR_PREFIX}${orderHash(order)}:${encodeValues(fields, values, codecs)}`,
  );
}

/**
 * Decodes a cursor boundary. A null is only valid on a column with a null placement. The message
 * never echoes the payload, which logs often capture verbatim.
 */
function decodeCursor(
  order: CursorOrder,
  value: string,
  codecs: FieldCodecs,
): Record<string, unknown> {
  let payload: string | undefined;
  try {
    payload = decodeBase64(value);
  } catch {}
  const prefix = `${CURSOR_PREFIX}${orderHash(order)}:`;
  const values = payload?.startsWith(prefix)
    ? decodeValues(cursorColumns(order), payload.slice(prefix.length), codecs)
    : undefined;
  if (!values || order.columns.some(({ field, nulls }) => values[field] === null && !nulls)) {
    throw new PothosValidationError('Invalid cursor.');
  }
  return values;
}

// Compares rows with the cursor lexicographically. Each OR clause requires the earlier columns to
// equal the cursor's values and compares the next column.
function buildLexicographicPredicate(
  order: CursorOrder,
  values: Record<string, unknown>,
  op: 'gt' | 'lt',
): (c: Record<string, ComparableColumn>) => unknown {
  return (c) => {
    const clauses = order.columns.map(({ field, direction, nulls }, i) => {
      const equalities = order.columns
        .slice(0, i)
        .map(({ field: prev }) =>
          values[prev] === null ? c[prev]!.isNull() : c[prev]!.eq(values[prev]),
        );
      const col = c[field]!;
      const v = values[field];
      const greater = (op === 'gt') !== (direction === 'desc');
      // Whether nulls sort beyond the boundary. Null placement doesn't change with direction.
      const nullsBeyond = !!nulls && (op === 'gt') === (nulls === 'last');
      let comparison: unknown;
      if (v === null) {
        // Nothing lies beyond a null boundary when nulls sort beyond it, and every non-null row
        // does otherwise. `decodeCursor` only accepts a null on a column with a null placement.
        comparison = nullsBeyond
          ? and(col.isNull() as never, col.isNotNull() as never)
          : col.isNotNull();
      } else {
        const beyond = greater ? col.gt(v) : col.lt(v);
        comparison = nullsBeyond ? or(beyond as never, col.isNull() as never) : beyond;
      }
      return equalities.length === 0
        ? comparison
        : and(...(equalities as never[]), comparison as never);
    });
    return clauses.length === 1 ? clauses[0] : or(...(clauses as never[]));
  };
}

/** How a connection pages for one request: its order, column codecs and page sizes. */
export interface CursorPlan {
  order: CursorOrder;
  codecs: FieldCodecs;
  defaultSize?: number;
  maxSize?: number;
}

interface CursorPaginationParams extends CursorPlan {
  before: string | undefined;
  after: string | undefined;
  limit: number;
  expectedSize: number;
  inverted: boolean;
  hasNextPage: (resultSize: number) => boolean;
  hasPreviousPage: (resultSize: number) => boolean;
}

function buildPaginationParams(
  plan: CursorPlan,
  args: PothosSchemaTypes.DefaultConnectionArguments,
): CursorPaginationParams {
  return {
    ...parseCursorConnectionArgs({ args, defaultSize: plan.defaultSize, maxSize: plan.maxSize }),
    ...plan,
  };
}

/**
 * The connection orders, filters past the cursor and limits the collection, so one that is
 * already ordered, limited or distinct would page silently wrong.
 */
function assertBareCollection(collection: unknown): void {
  const { orderBy, paginated, distinct } = getCollectionPaginationState(collection);
  if (orderBy.length || paginated) {
    throw new InternalError(
      "Connection resolvers must return an unordered, unpaginated Collection without orderBy(), cursor(), limit(), or offset(). Use the connection's orderBy option to order it.",
    );
  }
  if (distinct) {
    throw new InternalError(
      'Connection resolvers cannot return a Collection with distinct() or distinctOn(): the rows a page keeps would depend on the columns the selection adds.',
    );
  }
}

function applyToCollection<C extends MapperCollection>(
  baseCollection: C,
  { order, before, after, limit, inverted, codecs }: CursorPaginationParams,
): C {
  let collection = baseCollection.orderBy(
    order.columns.map(({ field, direction, nulls }) => (c: Record<string, ComparableColumn>) => {
      const forward = c[field]![direction](nulls ? { nulls } : undefined);
      return inverted ? forward.reverse() : forward;
    }),
  );
  // The ORM's `cursor()` takes one boundary in the order's direction and can't place nulls, so
  // the boundaries are applied as filters.
  if (after) {
    collection = collection.where(
      buildLexicographicPredicate(order, decodeCursor(order, after, codecs), 'gt'),
    );
  }
  if (before) {
    collection = collection.where(
      buildLexicographicPredicate(order, decodeCursor(order, before, codecs), 'lt'),
    );
  }
  return collection.limit(limit) as C;
}

/** Throws what pagination would throw for `args`, without a collection. */
export function validateCursorArgs(
  plan: CursorPlan,
  args: PothosSchemaTypes.DefaultConnectionArguments,
): void {
  const { before, after, order, codecs } = buildPaginationParams(plan, args);
  if (after) {
    decodeCursor(order, after, codecs);
  }
  if (before) {
    decodeCursor(order, before, codecs);
  }
}

/** Orders `baseCollection`, filters it past the cursors and limits it to the page. */
export function applyCursorPagination<C extends MapperCollection>(
  baseCollection: C,
  plan: CursorPlan,
  args: PothosSchemaTypes.DefaultConnectionArguments,
): C {
  assertBareCollection(baseCollection);
  return applyToCollection(baseCollection, buildPaginationParams(plan, args));
}

interface PageInfo {
  startCursor: string | null;
  endCursor: string | null;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ConnectionPage<Row> {
  edges: Array<{ node: Row; cursor: string }>;
  pageInfo: PageInfo;
  totalCount?: number;
  /** The connection field's parent and arguments, as the sibling plugins pass them. */
  parent?: unknown;
  args?: PothosSchemaTypes.DefaultConnectionArguments;
}

/**
 * Cursors are encoded lazily, so a selection without them encodes nothing. Edge cursors are
 * non-enumerable, so spreading or serialising an edge doesn't encode them.
 */
export function buildConnectionPage<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  plan: CursorPlan,
  args: PothosSchemaTypes.DefaultConnectionArguments,
  { totalCount, parent }: Pick<ConnectionPage<Row>, 'totalCount' | 'parent'> = {},
): ConnectionPage<Row> {
  const pagination = buildPaginationParams(plan, args);
  const needsCopy = pagination.inverted || rows.length > pagination.expectedSize;
  const trimmed: Row[] = needsCopy ? rows.slice(0, pagination.expectedSize) : (rows as Row[]);
  const ordered = pagination.inverted ? trimmed.reverse() : trimmed;

  const edges = ordered.map((node) => {
    let cached: string | undefined;
    const edge = { node } as { node: Row; cursor: string };
    Object.defineProperty(edge, 'cursor', {
      enumerable: false,
      configurable: true,
      get() {
        cached ??= encodeCursor(pagination.order, node, pagination.codecs);
        return cached;
      },
    });
    return edge;
  });

  return {
    parent,
    args,
    edges,
    // Lazy as well, so a row whose cursor can't be encoded only fails a client that selects it.
    pageInfo: {
      get startCursor() {
        return edges[0]?.cursor ?? null;
      },
      get endCursor() {
        return edges[edges.length - 1]?.cursor ?? null;
      },
      hasPreviousPage: pagination.hasPreviousPage(rows.length),
      hasNextPage: pagination.hasNextPage(rows.length),
    },
    ...(totalCount === undefined ? {} : { totalCount }),
  };
}
