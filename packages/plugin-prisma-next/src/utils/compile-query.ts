import type { RefineCallback } from '../extensions';

interface QueryLiteralShape {
  where?: unknown;
  orderBy?: unknown;
  take?: number;
  skip?: number;
}

function isFunction(v: unknown): v is (args: unknown, ctx: unknown) => unknown {
  return typeof v === 'function';
}

function isEmptyLiteral(q: QueryLiteralShape | null | undefined): boolean {
  // Tolerate null/undefined from the callback form so `query: (args) =>
  // args.foo ? {...} : undefined` doesn't crash.
  return (
    q == null ||
    (q.where === undefined &&
      q.orderBy === undefined &&
      q.take === undefined &&
      q.skip === undefined)
  );
}

/** @internal */
export function compileQuery(query: unknown): RefineCallback | undefined {
  if (query === undefined) {
    return undefined;
  }
  if (!isFunction(query) && isEmptyLiteral(query as QueryLiteralShape)) {
    return undefined;
  }

  return (rel: unknown, args: unknown, ctx: unknown) => {
    const resolved = isFunction(query)
      ? (query(args, ctx) as QueryLiteralShape | null | undefined)
      : (query as QueryLiteralShape);

    if (isEmptyLiteral(resolved)) {
      return rel;
    }
    const literal = resolved as QueryLiteralShape;

    let r = rel as {
      where: (w: unknown) => unknown;
      orderBy: (cb: unknown) => unknown;
      take: (n: number) => unknown;
      skip: (n: number) => unknown;
    };

    if (literal.where !== undefined) {
      r = r.where(literal.where) as typeof r;
    }
    if (literal.orderBy !== undefined) {
      r = r.orderBy(literal.orderBy) as typeof r;
    }
    if (literal.take !== undefined) {
      r = r.take(literal.take) as typeof r;
    }
    if (literal.skip !== undefined) {
      r = r.skip(literal.skip) as typeof r;
    }
    return r;
  };
}

/** @internal */
export function compileWhere(where: unknown): RefineCallback | undefined {
  if (where === undefined) {
    return undefined;
  }
  return (rel: unknown, args: unknown, ctx: unknown) => {
    const r = rel as { where: (w: unknown) => unknown };
    if (typeof where === 'function') {
      const predicateFn = where as (accessor: unknown, args: unknown, ctx: unknown) => unknown;
      return r.where((accessor: unknown) => predicateFn(accessor, args, ctx));
    }
    return r.where(where);
  };
}
