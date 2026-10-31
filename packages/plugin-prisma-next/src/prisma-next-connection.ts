import {
  type FieldKind,
  type InputFieldMap,
  PothosSchemaError,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { CursorSpec, ModelName, PrismaNextConnectionFieldOptions } from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { assertContextObject, getPluginConfig } from './utils/config.js';
import {
  aggregateCount,
  CONNECTION_NODE_PATHS,
  connectionNeedsRows,
  connectionSettings,
} from './utils/connections.js';
import { assertVariantCollection } from './utils/contract.js';
import {
  applyCursorPagination,
  assertUnpaginatedCollection,
  buildConnectionPage,
  type CursorInput,
  cursorColumns,
  type RequestOrderBy,
  validateCursor,
} from './utils/cursors.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { getModel } from './utils/model.js';
import { refFor } from './utils/refs.js';
import { materializeRows } from './utils/selections.js';

const rootFieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

rootFieldBuilderProto.prismaConnection = function prismaConnection<
  Types extends SchemaTypes,
  ParentShape,
  M extends ModelName<Types>,
  Param extends M | PrismaNextObjectRef<Types, M, unknown>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  Cursor extends CursorSpec<Types, M>,
  ResolveReturnShape,
>(
  this: typeof rootFieldBuilderProto & {
    builder: PothosSchemaTypes.SchemaBuilder<Types>;
    connection: (cfg: object, c?: object, e?: object) => unknown;
  },
  options: PrismaNextConnectionFieldOptions<
    Types,
    ParentShape,
    M,
    Param,
    Nullable,
    Args,
    Cursor,
    ResolveReturnShape
  >,
  connectionOptions: object = {},
  edgeOptions: object = {},
) {
  if (typeof this.connection !== 'function') {
    throw new PothosSchemaError('t.prismaConnection requires @pothos/plugin-relay to be loaded.');
  }
  const {
    type,
    cursor,
    defaultSize,
    maxSize,
    resolve,
    totalCount,
    orderBy,
    query: _querySentinel,
    ...rest
  } = options as {
    type: unknown;
    cursor: unknown;
    defaultSize?: number | ((args: unknown, ctx: unknown) => number);
    maxSize?: number | ((args: unknown, ctx: unknown) => number);
    resolve: (
      parent: unknown,
      args: unknown,
      ctx: unknown,
      info: GraphQLResolveInfo,
    ) => MapperCollection | null | Promise<MapperCollection | null>;
    totalCount?:
      | boolean
      | ((parent: unknown, args: unknown, ctx: unknown, info: GraphQLResolveInfo) => unknown);
    orderBy?: (model: never, args: unknown, ctx: unknown) => ReturnType<RequestOrderBy>;
    query?: unknown;
    [k: string]: unknown;
  };
  const ref = refFor(this.builder, type);
  const config = getPluginConfig(this.builder);
  const settings = connectionSettings(config, {
    defaultSize,
    maxSize,
    totalCount: totalCount as
      | boolean
      | ((parent: unknown, args: unknown, ctx: object, info: GraphQLResolveInfo) => unknown)
      | undefined,
  });
  const modelName = ref.modelName as string;
  const cursorSpec = validateCursor(config.contract, modelName, cursor as CursorInput);

  return this.connection(
    {
      ...(rest as object),
      type: ref,
      resolve: (async (
        parent: unknown,
        args: unknown,
        context: object,
        info: GraphQLResolveInfo,
      ) => {
        assertContextObject(context, info);
        const relayArgs = args as PothosSchemaTypes.DefaultConnectionArguments;
        const userCollection = await resolve(parent, args, context, info);

        if (userCollection == null) {
          return null;
        }
        assertUnpaginatedCollection(userCollection);
        assertVariantCollection(config.contract, modelName, userCollection);
        const needsRows = connectionNeedsRows(context, info);
        const applied = needsRows
          ? await applySelectionToCollection(userCollection, info, config, context, {
              paths: CONNECTION_NODE_PATHS,
              extraColumns: cursorColumns(cursorSpec),
            })
          : userCollection;

        // Validates the ordering even for count-only selections; no rows are fetched here.
        const pagination = applyCursorPagination(applied, cursorSpec, relayArgs, {
          ...settings.sizes(args as object, context),
          codecs: config.codecs(context, modelName),
          orderBy: orderBy && ((model) => orderBy(model as never, args, context)),
        });

        const rowsPromise = needsRows
          ? Promise.resolve()
              .then(() =>
                (
                  pagination.collection as unknown as {
                    all(): Promise<readonly Record<string, unknown>[]>;
                  }
                ).all(),
              )
              .then((rows) => materializeRows(rows, getModel(config.contract, modelName)))
          : Promise.resolve([]);

        // Counted before pagination, so it matches the paged rows.
        const countSource = settings.countSource(context, info);
        const countPromise =
          countSource === 'aggregate'
            ? aggregateCount(userCollection)
            : Promise.resolve().then(() => countSource?.(parent, args, context, info));

        // Promise.all handles both rejections, so a later one isn't left unhandled.
        const [rows, count] = await Promise.all([rowsPromise, countPromise]);
        return buildConnectionPage(
          rows as readonly Record<string, unknown>[],
          pagination,
          count as number | undefined,
        );
      }) as never,
    } as never,
    settings.connectionOptions(connectionOptions),
    edgeOptions,
  );
} as never;
