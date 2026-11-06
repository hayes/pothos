import {
  type FieldKind,
  type InputFieldMap,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { PrismaNextConnectionFieldOptions } from './types/connections.js';
import type { ModelKey } from './types/models.js';
import type { MapperCollection } from './utils/adapter.js';
import { getPluginConfig } from './utils/config.js';
import {
  aggregateCount,
  CONNECTION_NODE_PATHS,
  type ConnectionSettingsOptions,
  connectionSettings,
} from './utils/connections.js';
import { applyCursorPagination, buildConnectionPage, cursorColumns } from './utils/cursors.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { getModel } from './utils/model.js';
import { type AnyRef, refFor } from './utils/refs.js';

interface PrismaFieldOptions {
  type: string | AnyRef | [string | AnyRef];
  resolve: (...args: unknown[]) => unknown;
}

type Executable = MapperCollection & { all(): Promise<readonly unknown[]> };

/**
 * Builds the config of a `prismaField`. A model name in `type` resolves to its ref. The resolver
 * applies the field's whole selection to the returned Collection and executes it, reading one row
 * for a singular field.
 */
function prismaFieldConfig(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  { type, resolve, ...options }: PrismaFieldOptions,
) {
  const isList = Array.isArray(type);
  const inner = isList ? type[0] : type;
  const ref = refFor(builder, inner);
  const modelKey = ref.modelKey as string;
  const config = getPluginConfig(builder);

  return {
    ...options,
    type: isList ? [ref] : ref,
    resolve: async (parent: unknown, args: unknown, context: object, info: GraphQLResolveInfo) => {
      const collection = (await resolve(parent, args, context, info)) as Executable | null;
      if (collection == null) {
        return collection;
      }
      const model = getModel(config.contract, modelKey);
      const applied = (await applySelectionToCollection(
        collection,
        model,
        info,
        config,
        context,
      )) as Executable;
      const rows = await (isList ? applied : (applied.limit(1) as Executable)).all();
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
  const { type, defaultSize, maxSize, resolve, totalCount, query, ...rest } =
    options as ConnectionSettingsOptions & {
      type: unknown;
      resolve: (
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
  const model = getModel(config.contract, modelKey);
  const settings = connectionSettings(config, modelKey, {
    defaultSize,
    maxSize,
    totalCount,
    query,
  });

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
        const userCollection = await resolve(parent, args, context, info);
        if (userCollection == null) {
          return null;
        }
        const planned = settings.plan(args, context);
        const { needsRows, count: countSource } = settings.selectionFor(context, info);
        const filtered =
          planned.where === undefined ? userCollection : userCollection.where(planned.where);
        // Runs for a count-only selection too, so the collection is still checked. No rows are
        // fetched here.
        const paged = applyCursorPagination(filtered, planned, args);
        const rowsPromise = needsRows
          ? Promise.resolve(
              applySelectionToCollection(paged, model, info, config, context, {
                paths: CONNECTION_NODE_PATHS,
                seed: { columns: cursorColumns(planned.order) },
              }),
            ).then((applied) =>
              (applied as unknown as { all(): Promise<Record<string, unknown>[]> }).all(),
            )
          : Promise.resolve([]);

        // Counts the collection the resolver returned, filtered by `query`, before pagination.
        const countPromise =
          countSource === 'aggregate'
            ? aggregateCount(filtered)
            : Promise.resolve().then(() => countSource?.(parent, args, context, info));

        // Promise.all handles both rejections, so a later one isn't left unhandled.
        const [rows, count] = await Promise.all([rowsPromise, countPromise]);
        return buildConnectionPage(rows, planned, args, { totalCount: count, parent });
      }) as never,
    } as never,
    settings.connectionOptions(connectionOptions),
    edgeOptions,
  );
} as never;
