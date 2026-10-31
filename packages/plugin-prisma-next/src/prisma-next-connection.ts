import {
  type FieldKind,
  type InputFieldMap,
  PothosSchemaError,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { PrismaNextInterfaceRef } from './interface-ref.js';
import { PrismaNextObjectRef } from './object-ref.js';
import type {
  AnyContract,
  CursorSpec,
  ModelName,
  PrismaNextConnectionFieldOptions,
} from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { createApply } from './utils/apply.js';
import { assertVariantCollection } from './utils/contract.js';
import {
  applyCursorPagination,
  assertUnpaginatedCollection,
  buildConnectionPage,
  type CursorInput,
  normalizeCursor,
  type RequestOrderBy,
  validateCursor,
} from './utils/cursors.js';
import {
  mapperOptionsFromPluginOpts,
  readPluginOptions,
  resolveSizeOption,
} from './utils/options.js';
import { getRefForContractModel } from './utils/refs.js';
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
    defaultSize?: unknown;
    maxSize?: unknown;
    resolve: unknown;
    totalCount?:
      | boolean
      | ((parent: unknown, args: unknown, ctx: unknown, info: GraphQLResolveInfo) => unknown);
    orderBy?: (model: never, args: unknown, ctx: unknown) => ReturnType<RequestOrderBy>;
    query?: unknown;
    [k: string]: unknown;
  };
  const ref =
    type instanceof PrismaNextObjectRef || type instanceof PrismaNextInterfaceRef
      ? type
      : getRefForContractModel(type as never, this.builder as never);
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

  const opts = readPluginOptions<AnyContract>(this.builder);
  if (!opts) {
    throw new PothosSchemaError(
      't.prismaConnection requires builder.options.prismaNext to be set.',
    );
  }
  const mapperOpts = mapperOptionsFromPluginOpts(opts);
  const cursorCols = normalizeCursor(cursor as CursorInput);
  const contract = opts.contract;
  const cursorSpec = validateCursor(contract, ref.modelName, cursor as CursorInput, opts.context);

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

        const userCollection = (await Promise.resolve(
          (
            resolve as unknown as (
              p: unknown,
              ar: unknown,
              ctx: unknown,
              i: GraphQLResolveInfo,
            ) => unknown
          )(parent, args, context, info),
        )) as MapperCollection | null;

        if (userCollection == null) {
          return null;
        }
        assertUnpaginatedCollection(userCollection);
        assertVariantCollection(contract, ref.modelName as string, userCollection as never);
        const needsRows = connectionNeedsRows(context as object, info);
        const apply = createApply({
          info,
          contract,
          context,
          mapperOpts,
          paths: [['edges', 'node'], ['nodes']],
          extraColumns: cursorCols,
        });
        const applied = (
          needsRows ? await apply(userCollection) : userCollection
        ) as MapperCollection;

        const sizes = {
          ...(resolvedDefault !== undefined ? { defaultSize: resolvedDefault } : {}),
          ...(resolvedMax !== undefined ? { maxSize: resolvedMax } : {}),
        };
        // Validates the ordering even for count-only selections; no rows are fetched here.
        const pagination = applyCursorPagination(applied, cursorSpec, relayArgs, {
          ...sizes,
          orderBy: orderBy && ((model) => orderBy(model as never, args, context)),
        });

        const rowsPromise = needsRows
          ? Promise.resolve().then(() =>
              (
                pagination.collection as unknown as {
                  all(): Promise<readonly Record<string, unknown>[]>;
                }
              ).all(),
            )
          : Promise.resolve([]);

        const countPromise = buildTotalCountPromise({
          info,
          enabled: totalCountFlag,
          resolver: totalCountResolver,
          baseCollection: userCollection,
          parent,
          args,
          context,
        });

        // allSettled so neither rejection goes unhandled; a rows error takes precedence.
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
