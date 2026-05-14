import type { RefineCallback } from '../extensions';

/**
 * Compile a relation-where option into a refine callback. Used by
 * `t.relatedConnection`'s `where` option and by
 * `prismaConnectionHelpers`'s `where` option to apply a filter to the
 * relation/base collection before pagination.
 *
 * @internal
 */
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
