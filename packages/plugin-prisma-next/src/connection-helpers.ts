import type { InputFieldMap, InputShapeFromFields, MaybePromise, SchemaTypes } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextObjectRef } from './object-ref';
import type { AnyContract, CollectionFor, CursorSpec, ModelName, Row } from './types';
import { applySelectionToCollection } from './utils/apply-selection';
import { compileWhere } from './utils/compile-query';
import {
  applyCursorPagination,
  buildConnectionPage,
  type ConnectionPage,
  normalizeCursor,
} from './utils/cursors';
import { mapperOptionsFromPluginOpts, readPluginOptions, resolveSizeOption } from './utils/options';
import { getRefFromContractModel } from './utils/refs';
import { wrapConnectionOptionsWithTotalCount } from './utils/total-count';

export interface PrismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Args extends InputFieldMap = {},
> {
  ref: PrismaNextObjectRef<Types, M>;
  /**
   * Pass `info` whenever possible — without it, the auto-include
   * mapper can't descend into `edges.node` and nested `t.relation`
   * fields under the connection won't preload.
   */
  applyPagination(
    collection: CollectionFor<Types, M>,
    args: InputShapeFromFields<Args> & import('@pothos/plugin-relay').DefaultConnectionArguments,
    info: GraphQLResolveInfo | undefined,
    ctx: Types['Context'],
  ): {
    collection: CollectionFor<Types, M>;
    totalCountPromise: Promise<number> | undefined;
    wrap<WrapRow extends Record<string, unknown>>(
      rows: readonly WrapRow[],
      totalCount?: number,
    ): ConnectionPage<WrapRow>;
  };
  getArgs(): Args;
  connectionOptions<T extends object>(connectionOptions: T): T;
}

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap = {},
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: {
    cursor: Cursor;
    args?: Args | ((t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Args);
    defaultSize?:
      | number
      | ((
          args: import('@pothos/plugin-relay').DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    maxSize?:
      | number
      | ((
          args: import('@pothos/plugin-relay').DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    totalCount?:
      | boolean
      | ((
          args: InputShapeFromFields<Args> &
            import('@pothos/plugin-relay').DefaultConnectionArguments,
          ctx: Types['Context'],
          info: GraphQLResolveInfo | undefined,
        ) => MaybePromise<number>);
    where?:
      | import('@prisma-next/sql-orm-client').ShorthandWhereFilter<Types['PrismaNextContract'], M>
      | ((
          accessor: import('@prisma-next/sql-orm-client').ModelAccessor<
            Types['PrismaNextContract'],
            M
          >,
          args: InputShapeFromFields<Args> &
            import('@pothos/plugin-relay').DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => unknown);
    resolveNode?: (edge: Row<Types, M>) => unknown;
  },
): PrismaConnectionHelpers<Types, M, Args> {
  const ref = getRefFromContractModel<Types, M>(modelName, builder);

  // `options.args` may be a literal or a thunk `(t) => argMap`; resolve
  // lazily so the InputFieldBuilder is in scope, cache so getArgs() is
  // idempotent.
  let resolvedArgs: Args | undefined;
  const resolveArgs = (): Args => {
    if (resolvedArgs !== undefined) {
      return resolvedArgs;
    }
    const raw = options.args;
    resolvedArgs =
      typeof raw === 'function'
        ? builder.args(raw as (t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Args)
        : (raw ?? ({} as Args));
    return resolvedArgs;
  };

  const totalCountResolver =
    typeof options.totalCount === 'function' ? options.totalCount : undefined;
  const totalCountFlag = options.totalCount === true || totalCountResolver !== undefined;

  // Hoist out of per-resolve closure — cursorCols depend on the static
  // option; pluginOpts/mapperOpts depend on the immutable builder.options.
  const cursorCols = normalizeCursor(options.cursor as string | readonly string[]);
  const pluginOpts = readPluginOptions<AnyContract>(builder);
  const mapperOpts = mapperOptionsFromPluginOpts(pluginOpts);

  return {
    ref,
    getArgs: () => resolveArgs(),
    connectionOptions<T extends object>(connectionOptions: T): T {
      return totalCountFlag
        ? (wrapConnectionOptionsWithTotalCount(connectionOptions) as T)
        : connectionOptions;
    },
    applyPagination(collection, args, info, ctx) {
      const defaultSize =
        resolveSizeOption(options.defaultSize, args, ctx) ?? pluginOpts?.defaultConnectionSize;
      const maxSize =
        resolveSizeOption(options.maxSize, args, ctx) ?? pluginOpts?.maxConnectionSize;
      const whereRefine = compileWhere(options.where);
      const filteredBase = whereRefine
        ? (whereRefine(collection, args, ctx) as CollectionFor<Types, M>)
        : collection;
      const pagination = applyCursorPagination(filteredBase as never, options.cursor, args, {
        ...(defaultSize !== undefined ? { defaultSize } : {}),
        ...(maxSize !== undefined ? { maxSize } : {}),
      });

      const prepared =
        info && pluginOpts
          ? (applySelectionToCollection(
              pagination.collection as never,
              info,
              pluginOpts.contract,
              ctx,
              {
                paths: [['edges', 'node'], ['nodes']],
                extraColumns: cursorCols,
                ...mapperOpts,
              },
            ) as unknown as CollectionFor<Types, M>)
          : (pagination.collection as unknown as CollectionFor<Types, M>);

      // Auto-aggregate runs against `filteredBase` (post-where, pre-
      // pagination) so the count and the page rows come from the same
      // filtered set. Counting `collection` would produce a "N of M"
      // mismatch when `where` narrows the result.
      const totalCountPromise: Promise<number> | undefined = totalCountResolver
        ? Promise.resolve().then(() => Promise.resolve(totalCountResolver(args, ctx, info)))
        : totalCountFlag
          ? Promise.resolve().then(() =>
              (
                filteredBase as unknown as {
                  aggregate: (
                    fn: (a: { count: () => unknown }) => Record<string, unknown>,
                  ) => Promise<Record<string, number>>;
                }
              )
                .aggregate((a) => ({ total: a.count() }))
                .then((r) => r.total),
            )
          : undefined;
      // Tap a noop catch so a rejection here doesn't surface as
      // unhandledRejection when the caller's Promise.all short-circuits
      // on the rows side.
      if (totalCountPromise) {
        totalCountPromise.catch(() => undefined);
      }

      return {
        collection: prepared,
        totalCountPromise,
        wrap<WrapRow extends Record<string, unknown>>(
          rows: readonly WrapRow[],
          totalCount?: number,
        ): ConnectionPage<WrapRow> {
          const page = buildConnectionPage(rows, pagination);
          // Apply resolveNode after buildConnectionPage so the cursor
          // encoder still sees the original row columns.
          if (options.resolveNode) {
            const transform = options.resolveNode;
            for (const edge of page.edges) {
              (edge as { node: unknown }).node = transform(edge.node as Row<Types, M>);
            }
          }
          if (totalCount !== undefined) {
            (page as { totalCount?: number }).totalCount = totalCount;
          }
          return page;
        },
      };
    },
  };
}
