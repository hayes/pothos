import {
  type InputFieldMap,
  type InputShapeFromFields,
  isThenable,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextObjectRef } from './object-ref.js';
import type {
  BareModelName,
  CollectionFor,
  ConnectionCollection,
  CursorSpec,
  ExactCursor,
  ModelName,
  NamespaceOf,
  Row,
  TotalCountFlag,
} from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { getPluginConfig } from './utils/config.js';
import { aggregateCount, connectionSettings } from './utils/connections.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  type ConnectionPage,
  type CursorInput,
  normalizeCursor,
  validateCursor,
} from './utils/cursors.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { getRefFromContractModel } from './utils/refs.js';
import { whereInput } from './utils/selections.js';

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
   * Without `info`, relations selected under the connection aren't preloaded. Returns a promise
   * when a `select` callback beneath the connection is async.
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
  cursor: Cursor & NoInfer<ExactCursor<Cursor>>;
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
    | TotalCountFlag<Types>
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
        BareModelName<M>
      >
    | ((
        accessor: import('@prisma/orm-family-sql/orm-client').ModelAccessor<
          Types['PrismaNextContract'],
          BareModelName<M>,
          NamespaceOf<Types, M>
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
  const ref = getRefFromContractModel<Types, M>(modelName, builder) as PrismaNextObjectRef<
    Types,
    M
  >;

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

  const cursorCols = normalizeCursor(options.cursor as CursorInput);
  const config = getPluginConfig(builder);
  const cursorSpec = validateCursor(config.contract, modelName, options.cursor);
  const settings = connectionSettings<
    (
      args: InputShapeFromFields<Args> & import('@pothos/plugin-relay').DefaultConnectionArguments,
      ctx: Types['Context'],
      info: GraphQLResolveInfo | undefined,
    ) => MaybePromise<number>
  >(config, options);

  return {
    ref,
    getArgs: () => resolveArgs(),
    connectionOptions: settings.connectionOptions,
    applyPagination(collection, args, info, ctx) {
      const filteredBase = (options.where === undefined
        ? collection
        : (collection as unknown as MapperCollection).where(
            whereInput(options.where, args, ctx as object),
          )) as unknown as CollectionFor<Types, M>;
      const pagination = applyCursorPagination(filteredBase as never, cursorSpec, args, {
        ...settings.sizes(args, ctx as object),
        codecs: config.codecs(ctx, modelName),
      });

      const prepared = (info
        ? applySelectionToCollection(pagination.collection, info, config, ctx, {
            paths: [['edges', 'node'], ['nodes']],
            extraColumns: cursorCols,
          })
        : pagination.collection) as unknown as MaybePromise<CollectionFor<Types, M>>;

      // Counted before pagination but after `where`, so it matches the paged rows.
      let totalCountPromise: Promise<number> | undefined;
      const getTotalCountPromise = () => {
        const counted = settings.countsRows(ctx as object, info);
        if (!counted && !settings.callsCount(ctx as object, info)) {
          return undefined;
        }
        totalCountPromise ??= counted
          ? aggregateCount(filteredBase)
          : Promise.resolve().then(() => settings.countCallback!(args, ctx, info));
        // Avoids an unhandled rejection; the consumer still sees it.
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
          // After building the page, so cursors are encoded from the original rows.
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
