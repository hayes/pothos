import {
  type FieldKind,
  type InputFieldMap,
  PothosSchemaError,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { PrismaNextObjectRef } from './object-ref.js';
import type {
  AnyContract,
  CursorSpec,
  ModelName,
  PrismaNextConnectionFieldOptions,
} from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { createApply } from './utils/apply.js';
import {
  applyCursorPagination,
  assertUnpaginatedCollection,
  buildConnectionPage,
  buildPaginationParams,
  type CursorInput,
  normalizeCursor,
  validateCursor,
} from './utils/cursors.js';
import {
  mapperOptionsFromPluginOpts,
  readPluginOptions,
  resolveSizeOption,
} from './utils/options.js';
import { getRefFromContractModel } from './utils/refs.js';
import {
  buildTotalCountPromise,
  connectionNeedsRows,
  wrapConnectionOptionsWithTotalCount,
} from './utils/total-count.js';

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
    builder: PothosSchemaTypes.SchemaBuilder<Types> & {
      options: { prismaNext?: { contract: AnyContract } };
    };
    connection?: (cfg: object, c?: object, e?: object) => unknown;
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
  // `query` is a porting sentinel on the option type — strip it so a JS
  // caller bypassing the type gate doesn't smuggle it through.
  const {
    type,
    cursor,
    defaultSize,
    maxSize,
    resolve,
    totalCount,
    query: _querySentinel,
    ...rest
  } = options as {
    type: unknown;
    cursor: unknown;
    defaultSize?: unknown;
    maxSize?: unknown;
    resolve: unknown;
    totalCount?:
      | boolean
      | ((parent: unknown, args: unknown, ctx: unknown, info: GraphQLResolveInfo) => unknown);
    query?: unknown;
    [k: string]: unknown;
  };
  const ref =
    type instanceof PrismaNextObjectRef
      ? type
      : getRefFromContractModel(type as never, this.builder as never);
  const totalCountResolver =
    typeof totalCount === 'function'
      ? (totalCount as (
          parent: unknown,
          args: unknown,
          ctx: unknown,
          info: GraphQLResolveInfo,
        ) => unknown)
      : undefined;
  const totalCountFlag = totalCount === true || totalCountResolver !== undefined;

  // Hoist plugin-wide reads + mapper options out of the per-resolve
  // closure — builder.options is immutable after construction.
  const opts = readPluginOptions<AnyContract>(this.builder);
  if (!opts) {
    throw new PothosSchemaError(
      't.prismaConnection requires builder.options.prismaNext to be set.',
    );
  }
  const mapperOpts = mapperOptionsFromPluginOpts(opts);
  const cursorCols = normalizeCursor(cursor as CursorInput);
  const contract = opts.contract;
  validateCursor(contract, ref.modelName, cursor as CursorInput);

  return this.connection(
    {
      ...(rest as object),
      type: ref,
      resolve: (async (
        parent: unknown,
        args: unknown,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => {
        if (typeof resolve !== 'function') {
          throw new PothosSchemaError(
            't.prismaConnection requires a `resolve` callback. ' +
              'Signature: resolve(parent, args, ctx, info) => Collection.',
          );
        }
        const relayArgs = args as import('@pothos/plugin-relay').DefaultConnectionArguments;
        const resolvedDefault =
          resolveSizeOption(defaultSize as never, args, context as object) ??
          opts.defaultConnectionSize;
        const resolvedMax =
          resolveSizeOption(maxSize as never, args, context as object) ?? opts.maxConnectionSize;

        // `extraColumns: cursorCols` forces cursor columns into the
        // SELECT even when the GraphQL query didn't ask for them; the
        // cursor encoder needs them on every row.
        // User returns a Collection; the plugin applies selection
        // (descending through edges.node / nodes) and pagination.
        const userCollection = (await Promise.resolve(
          (
            resolve as unknown as (
              p: unknown,
              ar: unknown,
              ctx: unknown,
              i: GraphQLResolveInfo,
            ) => unknown
          )(parent, args, context, info),
        )) as MapperCollection;

        assertUnpaginatedCollection(userCollection);
        const needsRows = connectionNeedsRows(context as object, info);
        const apply = createApply({
          info,
          contract,
          context,
          mapperOpts,
          paths: [['edges', 'node'], ['nodes']],
          extraColumns: cursorCols,
        });
        // A promise only when a select callback beneath the field was async.
        const applied = (
          needsRows ? await apply(userCollection) : userCollection
        ) as MapperCollection;

        const sizes = {
          ...(resolvedDefault !== undefined ? { defaultSize: resolvedDefault } : {}),
          ...(resolvedMax !== undefined ? { maxSize: resolvedMax } : {}),
        };
        const pagination = needsRows
          ? applyCursorPagination(applied, cursor as never, relayArgs, sizes)
          : {
              ...buildPaginationParams(cursor as CursorInput, relayArgs, sizes),
              collection: applied,
            };

        const rowsPromise = needsRows
          ? Promise.resolve().then(() =>
              (
                pagination.collection as unknown as {
                  all(): Promise<readonly Record<string, unknown>[]>;
                }
              ).all(),
            )
          : Promise.resolve([]);

        // totalCount runs against the user-returned collection (post-
        // apply, pre-pagination) — apply only adds includes/selects,
        // which don't affect .count(). Cursor pagination's where/take
        // are NOT included so the count reflects the filtered set, not
        // just the current page.
        const countPromise = buildTotalCountPromise({
          info,
          enabled: totalCountFlag,
          resolver: totalCountResolver,
          baseCollection: userCollection,
          parent,
          args,
          context,
        });

        // allSettled keeps both rejections attached so an unawaited
        // failure doesn't escape as unhandledRejection. Rows win the
        // tie because a missing totalCount is recoverable.
        const [rowsResult, countResult] = await Promise.allSettled([rowsPromise, countPromise]);
        if (rowsResult.status === 'rejected') {
          throw rowsResult.reason;
        }
        if (countResult.status === 'rejected') {
          throw countResult.reason;
        }
        const page = buildConnectionPage(
          rowsResult.value as readonly Record<string, unknown>[],
          pagination,
        );
        if (countResult.value !== undefined) {
          (page as { totalCount?: number }).totalCount = countResult.value;
        }
        return page;
      }) as never,
    } as never,
    totalCountFlag ? wrapConnectionOptionsWithTotalCount(connectionOptions) : connectionOptions,
    edgeOptions,
  );
} as never;
