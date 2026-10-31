import type { RefineCallback } from '../extensions.js';

/** @internal */
export function compileWhere(where: unknown): RefineCallback | undefined {
  if (where === undefined) {
    return undefined;
  }
  return (rel: unknown, args: unknown, ctx: unknown) => {
    const r = rel as { where: (w: unknown) => unknown };
    if (typeof where === 'function') {
      const predicateFn = where as (
        accessor: unknown,
        args: unknown,
        ctx: unknown,
        tools: unknown,
      ) => unknown;
      return r.where((accessor: unknown, tools: unknown) =>
        predicateFn(accessor, args, ctx, tools),
      );
    }
    return r.where(where);
  };
}
