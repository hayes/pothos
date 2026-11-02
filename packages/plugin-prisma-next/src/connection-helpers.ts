import {
  type InputFieldMap,
  type InputShapeFromFields,
  isThenable,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type {
  CollectionFor,
  ConnectionPagingOptions,
  ConnectionQuery,
  CursorSpec,
  ModelName,
  ResolverCollection,
  Row,
  TotalCountFlag,
} from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { assertContextObject, getPluginConfig } from './utils/config.js';
import {
  aggregateCount,
  CONNECTION_NODE_PATHS,
  connectionQuery,
  connectionSettings,
} from './utils/connections.js';
import { assertVariantCollection } from './utils/contract.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  type ConnectionPage,
  cursorColumns,
  validateCursor,
} from './utils/cursors.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { getModel } from './utils/model.js';
import { refFor } from './utils/refs.js';
import { materializeRows } from './utils/selections.js';

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
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
> {
  /** The ref passed in. For a model name, `Ref` isn't inferred, so this is its default ref. */
  ref: HelperRef<Types, M> extends Ref ? PrismaNextObjectRef<Types, M, Row<Types, M>> : Ref;
  /**
   * Without `info`, relations selected under the connection aren't preloaded. Returns a promise
   * when a `select` callback beneath the connection is async.
   */
  applyPagination(
    collection: ResolverCollection<Types, M>,
    args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    info?: GraphQLResolveInfo,
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

/** A `prismaObject` or `prismaInterface` ref whose type the connection's nodes use. */
export type HelperRef<Types extends SchemaTypes, M extends ModelName<Types>> =
  | PrismaNextObjectRef<Types, M, unknown>
  | PrismaNextInterfaceRef<Types, M, unknown>;

export interface PrismaConnectionHelperOptions<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap,
> extends Pick<
    ConnectionPagingOptions<Types, unknown, Args, Cursor>,
    'cursor' | 'defaultSize' | 'maxSize'
  > {
  args?: Args | ((t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Args);
  totalCount?:
    | TotalCountFlag<Types>
    | ((
        args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
        ctx: Types['Context'],
        info: GraphQLResolveInfo | undefined,
      ) => MaybePromise<number>);
  /** Filters the collection and orders its cursor columns, like `t.relatedConnection`'s `query`. */
  query?: ConnectionQuery<Types, M, Args>;
}

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap = {},
  Node = never,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, Cursor, Args> & {
    resolveNode: (edge: Row<Types, M>) => Node;
  },
): PrismaConnectionHelpers<Types, M, Args, Node, false, Ref>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap = {},
  Node = never,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, Cursor, Args> & {
    resolveNode?: ((edge: Row<Types, M>) => Node) | undefined;
  },
): PrismaConnectionHelpers<Types, M, Args, Node, true, Ref>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Cursor extends CursorSpec<Types, M>,
  Args extends InputFieldMap = {},
  Node = never,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, Cursor, Args> & {
    resolveNode?: ((edge: Row<Types, M>) => Node) | undefined;
  },
): object {
  const ref = refFor(builder, refOrModel) as never as PrismaNextObjectRef<Types, M>;
  const modelName = ref.modelName;

  let args: Args | undefined;
  const config = getPluginConfig(builder);
  config.adapter.loadsRowsOf(ref.name);
  const cursorOrder = validateCursor(config.contract, modelName, options.cursor);
  const settings = connectionSettings<
    (
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      ctx: Types['Context'],
      info: GraphQLResolveInfo | undefined,
    ) => MaybePromise<number>
  >(config, options);

  return {
    ref: ref as never,
    getArgs: () =>
      (args ??=
        typeof options.args === 'function'
          ? builder.args(options.args)
          : (options.args ?? ({} as Args))),
    connectionOptions: settings.connectionOptions,
    applyPagination(collection, args, ctx, info) {
      // Report an invalid cursor or collection as a rejected promise instead of throwing, so
      // callers handle every failure in one place.
      try {
        return paginate(collection, args, ctx, info);
      } catch (error) {
        return Promise.reject(error);
      }
    },
  } satisfies PrismaConnectionHelpers<Types, M, Args, Node, boolean, Ref>;

  function paginate(
    collection: ResolverCollection<Types, M>,
    args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    info: GraphQLResolveInfo | undefined,
  ) {
    assertContextObject(ctx, info);
    assertVariantCollection(config.contract, modelName, collection as never);
    const { where, orderBy } = connectionQuery(options.query, args, ctx as object);
    const filteredBase = (where === undefined
      ? collection
      : (collection as unknown as MapperCollection).where(where)) as unknown as CollectionFor<
      Types,
      M
    >;
    const pagination = applyCursorPagination(filteredBase as never, cursorOrder, args, {
      ...settings.sizes(args, ctx as object),
      codecs: config.codecs(ctx, modelName),
      orderBy,
    });

    const prepared = (info
      ? applySelectionToCollection(pagination.collection, info, config, ctx, {
          paths: CONNECTION_NODE_PATHS,
          extraColumns: cursorColumns(cursorOrder),
        })
      : pagination.collection) as unknown as MaybePromise<CollectionFor<Types, M>>;

    // Counted before pagination but after `where`, so it matches the paged rows.
    let totalCountPromise: Promise<number> | undefined;
    const getTotalCountPromise = () => {
      const source = settings.countSource(ctx as object, info);
      if (!source) {
        return undefined;
      }
      if (!totalCountPromise) {
        totalCountPromise =
          source === 'aggregate'
            ? aggregateCount(filteredBase)
            : Promise.resolve().then(() => source(args, ctx, info));
        // Marks the rejection as handled. The consumer still receives it from the promise.
        totalCountPromise.catch(() => undefined);
      }
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
        const page = buildConnectionPage(
          materializeRows(rows, getModel(config.contract, modelName)),
          pagination,
          totalCount,
        );
        // After building the page, so cursors are encoded from the original rows.
        if (options.resolveNode) {
          const transform = options.resolveNode;
          for (const edge of page.edges) {
            (edge as { node: unknown }).node = transform(edge.node as Row<Types, M>);
          }
        }
        return page as unknown as ConnectionPage<ConnectionNodeShape<Node, WrapRow, boolean>>;
      },
    });

    return isThenable(prepared) ? prepared.then(withCollection) : withCollection(prepared);
  }
}
