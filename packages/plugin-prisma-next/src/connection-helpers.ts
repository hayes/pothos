import {
  type InputFieldMap,
  type InputShapeFromFields,
  isThenable,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import { selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextObjectRef } from './object-ref.js';
import type {
  AnyContract,
  CollectionFor,
  ConnectionCollection,
  CursorSpec,
  ModelName,
  NamespaceOf,
  Row,
} from './types.js';
import { compileWhere } from './utils/compile-query.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  type ConnectionPage,
  type CursorInput,
  normalizeCursor,
  validateCursor,
} from './utils/cursors.js';
import { applySelectionToCollection } from './utils/map-query.js';
import {
  mapperOptionsFromPluginOpts,
  readPluginOptions,
  resolveSizeOption,
} from './utils/options.js';
import { getRefFromContractModel } from './utils/refs.js';
import { aggregateCount, wrapConnectionOptionsWithTotalCount } from './utils/total-count.js';

export type ConnectionNodeShape<Node, WrapRow, MaybeAbsent extends boolean> = [Node] extends [never]
  ? WrapRow
  : MaybeAbsent extends true
    ? Node | WrapRow
    : Node;

export type ConnectionWrapRows<Types extends SchemaTypes, M extends ModelName<Types>, Node> = [
  Node,
] extends [never]
  ? Record<string, unknown>
  : Row<Types, M>;

export interface PrismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Args extends InputFieldMap = {},
  Node = never,
  MaybeAbsent extends boolean = false,
> {
  ref: PrismaNextObjectRef<Types, M>;
  /**
   * Pass `info` whenever possible — without it, the auto-include
   * mapper can't descend into `edges.node` and nested `t.relation`
   * fields under the connection won't preload.
   *
   * A promise only when a `select` callback beneath the connection returned one, so
   * `await` it: the collection is not usable until the selection it carries has settled.
   */
  applyPagination(
    collection: ConnectionCollection<Types, M>,
    args: InputShapeFromFields<Args> & import('@pothos/plugin-relay').DefaultConnectionArguments,
    info: GraphQLResolveInfo | undefined,
    ctx: Types['Context'],
  ): MaybePromise<{
    collection: CollectionFor<Types, M>;
    totalCountPromise: Promise<number> | undefined;
    wrap<WrapRow extends ConnectionWrapRows<Types, M, Node>>(
      rows: readonly WrapRow[],
      totalCount?: number,
    ): ConnectionPage<ConnectionNodeShape<Node, WrapRow, MaybeAbsent>>;
  }>;
  getArgs(): Args;
  connectionOptions<T extends object>(connectionOptions: T): T;
}

export interface PrismaConnectionHelperOptions<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap,
> {
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
    | import('@prisma/orm-family-sql/orm-client').ShorthandWhereFilter<
        Types['PrismaNextContract'],
        NamespaceOf<Types, M>,
        M
      >
    | ((
        accessor: import('@prisma/orm-family-sql/orm-client').ModelAccessor<
          Types['PrismaNextContract'],
          M
        >,
        args: InputShapeFromFields<Args> &
          import('@pothos/plugin-relay').DefaultConnectionArguments,
        ctx: Types['Context'],
      ) => unknown);
}

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap = {},
  Node = never,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaConnectionHelperOptions<Types, M, Cursor, Args> & {
    resolveNode: (edge: Row<Types, M>) => Node;
  },
): PrismaConnectionHelpers<Types, M, Args, Node, false>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap = {},
  Node = never,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaConnectionHelperOptions<Types, M, Cursor, Args> & {
    resolveNode?: ((edge: Row<Types, M>) => Node) | undefined;
  },
): PrismaConnectionHelpers<Types, M, Args, Node, true>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap = {},
  Node = never,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaConnectionHelperOptions<Types, M, Cursor, Args> & {
    resolveNode?: ((edge: Row<Types, M>) => Node) | undefined;
  },
): PrismaConnectionHelpers<Types, M, Args, Node, boolean> {
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
  const cursorCols = normalizeCursor(options.cursor as CursorInput);
  const pluginOpts = readPluginOptions<AnyContract>(builder);
  const mapperOpts = mapperOptionsFromPluginOpts(pluginOpts);
  const cursorSpec = pluginOpts
    ? validateCursor(pluginOpts.contract, modelName, options.cursor)
    : options.cursor;

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
      const pagination = applyCursorPagination(filteredBase as never, cursorSpec, args, {
        ...(defaultSize !== undefined ? { defaultSize } : {}),
        ...(maxSize !== undefined ? { maxSize } : {}),
      });

      // A promise here only when a `select` callback beneath the connection returned one; the
      // awaited collection is what the caller gets, never the promise dressed as one.
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
            ) as unknown as MaybePromise<CollectionFor<Types, M>>)
          : (pagination.collection as unknown as CollectionFor<Types, M>);

      // Auto-aggregate runs against `filteredBase` (post-where, pre-
      // pagination) so the count and the page rows come from the same
      // filtered set. Counting `collection` would produce a "N of M"
      // mismatch when `where` narrows the result.
      let totalCountPromise: Promise<number> | undefined;
      const getTotalCountPromise = () => {
        if (
          !totalCountFlag ||
          (info && !selectedFieldNames(ctx as object, info).has('totalCount'))
        ) {
          return undefined;
        }
        totalCountPromise ??= totalCountResolver
          ? Promise.resolve().then(() => totalCountResolver(args, ctx, info))
          : aggregateCount(filteredBase);
        // Helpers can start row and count work independently. Attach a rejection
        // handler immediately while retaining rejection for the consumer.
        totalCountPromise.catch(() => undefined);
        return totalCountPromise;
      };

      const withCollection = (collection: CollectionFor<Types, M>) => ({
        collection,
        get totalCountPromise() {
          return getTotalCountPromise();
        },
        wrap<WrapRow extends ConnectionWrapRows<Types, M, Node>>(
          rows: readonly WrapRow[],
          totalCount?: number,
        ): ConnectionPage<ConnectionNodeShape<Node, WrapRow, boolean>> {
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
          return page as unknown as ConnectionPage<ConnectionNodeShape<Node, WrapRow, boolean>>;
        },
      });

      return isThenable(prepared) ? prepared.then(withCollection) : withCollection(prepared);
    },
  };
}
