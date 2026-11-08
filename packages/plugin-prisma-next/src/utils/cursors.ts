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
import type { PrismaNextExecutionContext } from '../types/plugin-options.js';
import type { MapperCollection } from './adapter.js';
import type { FieldCodecs } from './codecs.js';
import { resolveContractModel } from './contract.js';
import { InternalError, isRefusedValue, refusedError } from './errors.js';
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

/** An `orderBy` as written: a direction per column, or `{ direction, nulls }`. */
export type OrderByDecl = Readonly<
  Record<string, Direction | { direction?: Direction; nulls?: 'first' | 'last' } | undefined>
>;

/** One column of an order. Nullable columns always have a null placement. */
export interface OrderColumn {
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

type OrderProblem = (field: string) => string | undefined;

/** Why the ORM can't order `modelKey`'s rows by `field`: it isn't a field, or its codec can't be. */
export function orderableProblem(
  context: PrismaNextExecutionContext<AnyContract>,
  modelKey: string,
): OrderProblem {
  const model = resolveContractModel(context.contract, modelKey)!;
  return (field) => {
    const type = model.fields[field]?.type as { codecId?: string } | undefined;
    if (!type) {
      return `'${modelKey}.${field}' is not a field of the model`;
    }
    return type.codecId &&
      context.codecDescriptors.descriptorFor(type.codecId)?.traits.includes('order')
      ? undefined
      : `'${modelKey}.${field}', whose codec the ORM can't order`;
  };
}

/**
 * Resolves an `orderBy` to its columns, each with its direction and null placement: nullable
 * columns put nulls last unless `nulls` says otherwise. Throws for a column `problem`
 * rejects. Without `problem`, only columns the model doesn't have are rejected: the types reject the
 * rest, and only a computed key can reach the runtime.
 */
export function orderColumns(
  contract: AnyContract,
  modelKey: string,
  decl: OrderByDecl | undefined,
  problem?: OrderProblem,
): OrderColumn[] {
  const model = resolveContractModel(contract, modelKey)!;
  const order: OrderColumn[] = [];
  for (const [field, entry] of Object.entries(decl ?? {})) {
    if (entry === undefined) {
      continue;
    }
    const reason = problem
      ? problem(field)
      : model.fields[field]
        ? undefined
        : `'${modelKey}.${field}' is not a field of the model`;
    if (reason) {
      throw new PothosSchemaError(`orderBy can't order by ${reason}.`);
    }
    const { direction = 'asc', nulls } = typeof entry === 'string' ? { direction: entry } : entry;
    const placement = nulls ?? (model.fields[field]!.nullable ? 'last' : undefined);
    order.push(placement ? { field, direction, nulls: placement } : { field, direction });
  }
  return order;
}

/** Orders `collection` by `columns`, reversed when `inverted`. */
export function orderCollection<C extends MapperCollection>(
  collection: C,
  columns: readonly OrderColumn[],
  inverted = false,
): C {
  return collection.orderBy(
    columns.map(({ field, direction, nulls }) => (c: Record<string, ComparableColumn>) => {
      const forward = c[field]![direction](nulls ? { nulls } : undefined);
      return inverted ? forward.reverse() : forward;
    }),
  ) as C;
}

/**
 * Resolves a connection's `orderBy` to the order it pages by, as `orderColumns` does. Its columns
 * also need values a cursor can hold. The model's first non-null key of orderable columns is
 * appended in the last column's direction, unless the order covers a key already, so every row has
 * its own position. Throws when the schema is built for a model without such a key.
 */
export function connectionOrder(
  context: PrismaNextExecutionContext<AnyContract>,
  modelKey: string,
): (decl: OrderByDecl | undefined) => CursorOrder {
  const { contract } = context;
  const orderable = orderableProblem(context, modelKey);
  const problem = (field: string) =>
    orderable(field) ?? truncatedDateProblem(contract, modelKey, field);
  const keys = getModelIdentities(contract, modelKey) ?? [];
  const key = keys.find((columns) => columns.every((field) => !problem(field)));
  if (!key) {
    const reason = keys[0]?.map(problem).find(Boolean);
    throw new PothosSchemaError(
      `Connections of '${modelKey}' page by a non-null primary or unique key of orderable columns, which it doesn't have${reason ? `: ${reason}` : ''}.`,
    );
  }
  return (decl) => {
    const order = orderColumns(contract, modelKey, decl, problem);
    const named = new Set(order.map(({ field }) => field));
    if (!keys.some((columns) => columns.every((field) => named.has(field)))) {
      const direction = order[order.length - 1]?.direction ?? 'asc';
      for (const field of key.filter((field) => !named.has(field))) {
        order.push({ field, direction });
      }
    }
    return { model: modelKey, columns: order };
  };
}

// Values are encoded in their column codec's stored form. Nulls skip the codec.
function encodeValues(fields: readonly string[], values: readonly unknown[], codecs: FieldCodecs) {
  const encoded = values.map((value, i) =>
    value == null ? value : codecs(fields[i]!).encode(value),
  );
  return encoded.length === 1 ? encodeCursorChunk(encoded[0]) : encodeCursorTuple(encoded);
}

/** The values of `fields` in `payload`, or undefined when it doesn't hold them. */
function decodeValues(
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

/**
 * How a connection pages for one request: its order, column codecs, page sizes, and the values of
 * its `after` and `before` cursors.
 */
export interface CursorPlan {
  order: CursorOrder;
  codecs: FieldCodecs;
  defaultSize?: number;
  maxSize?: number;
  afterValues?: Record<string, unknown>;
  beforeValues?: Record<string, unknown>;
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

function applyToCollection<C extends MapperCollection>(
  baseCollection: C,
  { order, afterValues, beforeValues, limit, inverted }: CursorPaginationParams,
): C {
  let collection: MapperCollection = orderCollection(baseCollection, order.columns, inverted);
  // The ORM's `cursor()` takes one boundary in the order's direction and can't place nulls, so
  // the boundaries are applied as filters.
  if (afterValues) {
    collection = collection.where(buildLexicographicPredicate(order, afterValues, 'gt'));
  }
  if (beforeValues) {
    collection = collection.where(buildLexicographicPredicate(order, beforeValues, 'lt'));
  }
  return collection.limit(limit) as C;
}

/** `plan` with the values of the cursors in `args`. Throws for an invalid cursor or page size. */
export function withCursorValues<Plan extends CursorPlan>(
  plan: Plan,
  args: PothosSchemaTypes.DefaultConnectionArguments,
): Plan {
  const { before, after, order, codecs } = buildPaginationParams(plan, args);
  return {
    ...plan,
    afterValues: after ? decodeCursor(order, after, codecs) : undefined,
    beforeValues: before ? decodeCursor(order, before, codecs) : undefined,
  };
}

/** Whether `plan` holds the values of a cursor. */
export function hasCursorValues(plan: CursorPlan): boolean {
  return plan.afterValues !== undefined || plan.beforeValues !== undefined;
}

/**
 * `rows`, read by a statement that applies cursor values when `cursors` is true. Its column codecs
 * accept values the database may still refuse, such as text holding a NUL, so a refused value then
 * fails as the client's `Invalid cursor.`.
 */
export function readPage<T>(rows: PromiseLike<T>, cursors: boolean): PromiseLike<T> {
  return cursors
    ? Promise.resolve(rows).catch((error: unknown) => {
        throw isRefusedValue(error) ? refusedError('Invalid cursor.', error) : error;
      })
    : rows;
}

/** Orders `baseCollection`, filters it past the cursors and limits it to the page. */
export function applyCursorPagination<C extends MapperCollection>(
  baseCollection: C,
  plan: CursorPlan,
  args: PothosSchemaTypes.DefaultConnectionArguments,
): C {
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
