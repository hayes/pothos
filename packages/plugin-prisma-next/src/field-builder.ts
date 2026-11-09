import {
  completeValue,
  type FieldKind,
  type InputFieldMap,
  type MaybePromise,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaObjectRef } from './object-ref.js';
import type { PrismaConnectionFieldOptions } from './types/connections.js';
import type { ModelKey } from './types/models.js';
import type { MapperCollection } from './utils/adapter.js';
import { relationLoad } from './utils/compile-select.js';
import { getPluginConfig } from './utils/config.js';
import {
  CONNECTION_NODE_PATHS,
  type ConnectionSettingsOptions,
  connectionPaging,
} from './utils/connections.js';
import { buildConnectionPage, orderableProblem } from './utils/cursors.js';
import { checkReturned } from './utils/errors.js';
import { applySelectionToCollection, nestedFromInfo } from './utils/map-query.js';
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
 * With `resolve`, the field's selection is applied to the type's collection and passed to it.
 * Otherwise `query` and the selection are applied to the collection and executed.
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
    applySelectionToCollection(source, modelKey, info, config, context) as MaybePromise<Executable>;
  const refinement = (value: unknown, options?: Parameters<typeof relationLoad>[3]) =>
    relationLoad(config.contract, modelKey, value, options).refine;
  const literal =
    typeof query === 'function'
      ? undefined
      : refinement(query, orderableProblem(config.context, modelKey));
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
          const planned = await plan(config.typeCollection(context, modelKey), info, context);
          return resolve(planned, parent, args, context, info);
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
          const applied = await plan(shape ? shape(source) : source, info, context);
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
  Param extends M | PrismaObjectRef<Types, M, unknown>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  QueryLiteral,
  ResolveReturnShape,
>(
  this: typeof rootFieldBuilderProto & {
    builder: PothosSchemaTypes.SchemaBuilder<Types>;
    connection: (cfg: object, c?: object, e?: object) => unknown;
  },
  options: PrismaConnectionFieldOptions<
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
    options as ConnectionSettingsOptions & { type: unknown; collection?: FieldResolver };
  const ref = refFor(this.builder, type);
  const config = getPluginConfig(this.builder);
  const modelKey = ref.modelKey as string;
  const paging = connectionPaging(config, modelKey, { defaultSize, maxSize, totalCount, query });
  const resolve = async (
    parent: unknown,
    args: PothosSchemaTypes.DefaultConnectionArguments,
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const source = (
      collection
        ? await collection(parent, args, context, info)
        : config.typeCollection(context, modelKey)
    ) as MapperCollection | null;
    if (source == null) {
      return null;
    }
    const nodes = nestedFromInfo(info, config, context, CONNECTION_NODE_PATHS);
    const page = await paging.rootPage(source, parent, args, context, info, (seed) =>
      completeValue(nodes(seed), (selection) => ({ selection })),
    );
    return buildConnectionPage(page.rows, page.plan, args, { totalCount: page.totalCount, parent });
  };
  return this.connection(
    { ...rest, type: ref, resolve } as never,
    paging.connectionOptions(connectionOptions),
    edgeOptions,
  );
} as never;
