import {
  type FieldKind,
  type InputFieldMap,
  type MaybePromise,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import { SqlQueryError } from '@prisma/orm-family-sql/errors';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { PrismaNextConnectionFieldOptions } from './types/connections.js';
import type { ModelKey } from './types/models.js';
import type { MapperCollection, PlannedQuery } from './utils/adapter.js';
import { relationLoad } from './utils/compile-select.js';
import { getPluginConfig } from './utils/config.js';
import {
  CONNECTION_NODE_PATHS,
  type ConnectionSettingsOptions,
  connectionPaging,
} from './utils/connections.js';
import { buildConnectionPage, orderableProblem, readPage } from './utils/cursors.js';
import { checkReturned, fieldInternalError } from './utils/errors.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { type AnyRef, refFor } from './utils/refs.js';

type FieldResolver = (...args: unknown[]) => unknown;

type PrismaFieldOptions = {
  type: string | AnyRef | [string | AnyRef];
  collection?: FieldResolver;
  query?: unknown;
  resolve?: FieldResolver;
};

type Executable = MapperCollection & { all(): Promise<readonly unknown[]> };

/**
 * Builds the config of a `prismaField`. A model name in `type` resolves to its ref. With `resolve`,
 * the resolver applies the field's selection to the type's collection and returns what `resolve`
 * returns for it. Otherwise it applies `query` and the selection to `collection`'s result, or to the
 * type's collection, and executes it, reading one row for a singular field. A literal `query` is
 * checked here, and a callback's result when a request runs.
 */
function prismaFieldConfig(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  { type, collection, query, resolve, ...options }: PrismaFieldOptions,
) {
  const isList = Array.isArray(type);
  const inner = isList ? type[0] : type;
  const ref = refFor(builder, inner);
  const modelKey = ref.modelKey as string;
  const config = getPluginConfig(builder);
  const plan = (source: MapperCollection, info: GraphQLResolveInfo, context: object) =>
    applySelectionToCollection(source, modelKey, info, config, context) as MaybePromise<
      PlannedQuery & { query: Executable }
    >;
  const refinement = (value: unknown, options?: Parameters<typeof relationLoad>[3]) =>
    relationLoad(config.contract, modelKey, value, options).refine;
  const literal =
    typeof query === 'function'
      ? undefined
      : refinement(query, { problem: orderableProblem(config.context, modelKey) });
  const refine =
    typeof query === 'function'
      ? (args: unknown, context: object) =>
          checkReturned(query(args, context), (value) => refinement(value))
      : () => literal;

  return {
    ...options,
    type: isList ? [ref] : ref,
    resolve: resolve
      ? async (parent: unknown, args: unknown, context: object, info: GraphQLResolveInfo) => {
          const planned = (await plan(config.typeCollection(context, modelKey), info, context))
            .query;
          try {
            return await resolve(planned, parent, args, context, info);
          } catch (error) {
            // A column the planned selection reads that the statement can't, as when a write on an
            // own-table variant returns the variant's columns, is the plugin's error. Any other
            // database error is the app's, as its own statements' are.
            throw isUndefinedColumn(error) ? fieldInternalError(info, error.message, error) : error;
          }
        }
      : async (parent: unknown, args: unknown, context: object, info: GraphQLResolveInfo) => {
          const source = (
            collection
              ? await collection(parent, args, context, info)
              : config.typeCollection(context, modelKey)
          ) as MapperCollection | null;
          if (source == null) {
            return source;
          }
          const shape = refine(args, context);
          const { query: applied, cursors } = await plan(
            shape ? shape(source) : source,
            info,
            context,
          );
          const rows = await readPage(
            (isList ? applied : (applied.limit(1) as Executable)).all(),
            cursors,
          );
          return isList ? rows : (rows[0] ?? null);
        },
  };
}

const rootFieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

rootFieldBuilderProto.prismaField = function prismaField(options) {
  return this.field(prismaFieldConfig(this.builder, options as PrismaFieldOptions) as never);
};

rootFieldBuilderProto.prismaFieldWithInput = function prismaFieldWithInput(
  this: typeof rootFieldBuilderProto,
  options: PrismaFieldOptions,
) {
  return (
    this as typeof rootFieldBuilderProto & { fieldWithInput: (options: object) => unknown }
  ).fieldWithInput(prismaFieldConfig(this.builder, options)) as never;
} as never;

rootFieldBuilderProto.prismaConnection = function prismaConnection<
  Types extends SchemaTypes,
  ParentShape,
  M extends ModelKey<Types>,
  Param extends M | PrismaNextObjectRef<Types, M, unknown>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  QueryLiteral,
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
    QueryLiteral,
    ResolveReturnShape
  >,
  connectionOptions: object = {},
  edgeOptions: object = {},
) {
  const { type, defaultSize, maxSize, collection, totalCount, query, ...rest } =
    options as ConnectionSettingsOptions & {
      type: unknown;
      collection?: (
        parent: unknown,
        args: unknown,
        ctx: unknown,
        info: GraphQLResolveInfo,
      ) => MapperCollection | null | Promise<MapperCollection | null>;
      [k: string]: unknown;
    };
  const ref = refFor(this.builder, type);
  const config = getPluginConfig(this.builder);
  const modelKey = ref.modelKey as string;
  const paging = connectionPaging(config, modelKey, { defaultSize, maxSize, totalCount, query });

  return this.connection(
    {
      ...(rest as object),
      type: ref,
      resolve: (async (
        parent: unknown,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        context: object,
        info: GraphQLResolveInfo,
      ) => {
        const userCollection = collection
          ? await collection(parent, args, context, info)
          : config.typeCollection(context, modelKey);
        if (userCollection == null) {
          return null;
        }
        const { rows, plan, totalCount } = await paging.loadPage(
          userCollection,
          parent,
          args,
          context,
          info,
          (paged, seed) =>
            applySelectionToCollection(paged, modelKey, info, config, context, {
              paths: CONNECTION_NODE_PATHS,
              seed,
            }),
        );
        return buildConnectionPage(rows, plan, args, { totalCount, parent });
      }) as never,
    } as never,
    paging.connectionOptions(connectionOptions),
    edgeOptions,
  );
} as never;

/** Whether `error` is the database refusing a column a statement names: Postgres, MySQL, SQLite. */
function isUndefinedColumn(error: unknown): error is SqlQueryError {
  return (
    SqlQueryError.is(error) &&
    (error.sqlState === '42703' ||
      error.sqlState === '42S22' ||
      error.message.startsWith('no such column'))
  );
}
