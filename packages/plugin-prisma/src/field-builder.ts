import {
  type FieldKind,
  type FieldRef,
  type InputFieldMap,
  isThenable,
  type MaybePromise,
  ObjectRef,
  PothosError,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import {
  type GraphQLResolveInfo,
  getNamedType,
  isInterfaceType,
  isObjectType,
  Kind,
} from 'graphql';
import { ModelLoader } from './model-loader.js';
import type { PrismaConnectionFieldOptions, PrismaModelTypes } from './types.js';
import {
  getCursorFormatter,
  getCursorParser,
  resolvePrismaCursorConnection,
} from './util/cursors.js';
import { getRefFromModel } from './util/datamodel.js';
import { queryFromInfo } from './util/map-query.js';
import { isUsed } from './util/usage.js';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

type PrismaFieldType = ObjectRef<SchemaTypes, unknown> | [ObjectRef<SchemaTypes, unknown> | string];

/** The `type` of a `prismaField`, with a model name resolved to its ref, list-ness kept. */
function refForType(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: PrismaFieldType | string,
) {
  const modelOrRef = Array.isArray(type) ? type[0] : type;
  const typeRef =
    typeof modelOrRef === 'string'
      ? getRefFromModel(modelOrRef, builder)
      : (modelOrRef as ObjectRef<SchemaTypes, unknown>);

  return Array.isArray(type) ? ([typeRef] as [ObjectRef<SchemaTypes, unknown>]) : typeRef;
}

/**
 * The resolver of a `prismaField`: the planned query for the field, then the user's resolver with
 * it. Built once per field, so a synchronous plan allocates nothing beyond this closure.
 */
function queryResolver(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  resolve: (...args: unknown[]) => unknown,
) {
  const run = (
    query: unknown,
    parent: unknown,
    args: unknown,
    context: {},
    info: GraphQLResolveInfo,
  ) =>
    checkIfQueryIsUsed(
      builder,
      query as object,
      info,
      resolve(query, parent, args, context, info) as never,
    );

  return (parent: never, args: unknown, context: {}, info: GraphQLResolveInfo) => {
    const query = queryFromInfo({
      context,
      info,
      withUsageCheck: !!builder.options.prisma?.onUnusedQuery,
      skipDeferredFragments: builder.options.prisma?.skipDeferredFragments,
    });

    return isThenable(query)
      ? query.then((resolved) => run(resolved, parent, args, context, info))
      : run(query, parent, args, context, info);
  };
}

fieldBuilderProto.prismaField = function prismaField({ type, resolve, ...options }) {
  return this.field({
    ...(options as {}),
    type: refForType(this.builder, type as PrismaFieldType),
    resolve: queryResolver(this.builder, resolve as never),
  }) as never;
};

fieldBuilderProto.prismaFieldWithInput = function prismaFieldWithInput(
  this: typeof fieldBuilderProto,
  {
    type,
    resolve,
    ...options
  }: { type: PrismaFieldType; resolve: (...args: unknown[]) => unknown },
) {
  return (
    this as typeof fieldBuilderProto & { fieldWithInput: typeof fieldBuilderProto.field }
  ).fieldWithInput({
    ...(options as {}),
    type: refForType(this.builder, type),
    resolve: queryResolver(this.builder, resolve),
  }) as never;
} as never;

fieldBuilderProto.prismaConnection = function prismaConnection<
  Type extends keyof SchemaTypes['PrismaTypes'],
  Nullable extends boolean,
  ResolveReturnShape,
  Args extends InputFieldMap,
  Model extends PrismaModelTypes,
>(
  this: typeof fieldBuilderProto,
  {
    type,
    cursor,
    maxSize = this.builder.options.prisma?.maxConnectionSize,
    defaultSize = this.builder.options.prisma?.defaultConnectionSize,
    resolve,
    totalCount,
    ...options
  }: PrismaConnectionFieldOptions<
    SchemaTypes,
    unknown,
    Type,
    Model,
    ObjectRef<SchemaTypes, {}>,
    Nullable,
    Args,
    ResolveReturnShape,
    FieldKind
  >,
  connectionOptions: {} = {},
  edgeOptions: {} = {},
) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this.builder) : type;
  const { name: typeName, extensions } = this.builder.configStore.getTypeConfig(ref);
  const model = extensions?.pothosPrismaModel as string;
  const formatCursor = getCursorFormatter(model, this.builder, cursor);
  const parseCursor = getCursorParser(model, this.builder, cursor);
  const cursorSelection = ModelLoader.getCursorSelection(ref, model, cursor, this.builder);

  // Built once per field: resolving with a synchronous plan allocates nothing beyond the
  // callback `resolvePrismaCursorConnection` was already handed.
  const resolveConnection = (
    query: object,
    parent: unknown,
    args: PothosSchemaTypes.DefaultConnectionArguments,
    context: {},
    info: GraphQLResolveInfo,
    totalCountOnly: boolean,
  ) =>
    resolvePrismaCursorConnection(
      {
        parent,
        query,
        ctx: context,
        parseCursor,
        maxSize,
        defaultSize,
        args,
        totalCount: totalCount && (() => totalCount(parent, args as never, context, info)),
      },
      formatCursor,
      (q) => {
        if (totalCountOnly) {
          return [];
        }

        return checkIfQueryIsUsed(
          this.builder,
          query,
          info,
          resolve(q as never, parent, args as never, context, info) as never,
        );
      },
    );

  const fieldRef = (
    this as typeof fieldBuilderProto & {
      connection: (...args: unknown[]) => FieldRef<SchemaTypes, unknown>;
    }
  ).connection(
    {
      ...options,
      type: ref,
      resolve: (
        parent: unknown,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        context: {},
        info: GraphQLResolveInfo,
      ) => {
        const returnType = getNamedType(info.returnType);
        const fields =
          isObjectType(returnType) || isInterfaceType(returnType) ? returnType.getFields() : {};

        const selections = info.fieldNodes;

        const totalCountOnly = selections.every((selection) =>
          selection.selectionSet?.selections.every(
            (s) =>
              s.kind === Kind.FIELD &&
              (fields[s.name.value]?.extensions?.pothosPrismaTotalCount ||
                s.name.value === '__typename'),
          ),
        );

        const query = queryFromInfo({
          context,
          info,
          select: cursorSelection as {},
          paths: [['nodes'], ['edges', 'node']],
          typeName,
          withUsageCheck: !!this.builder.options.prisma?.onUnusedQuery,
          skipDeferredFragments: this.builder.options.prisma?.skipDeferredFragments,
        });

        return isThenable(query)
          ? query.then((resolved) =>
              resolveConnection(resolved as object, parent, args, context, info, totalCountOnly),
            )
          : resolveConnection(query, parent, args, context, info, totalCountOnly);
      },
    },
    connectionOptions instanceof ObjectRef
      ? connectionOptions
      : {
          ...connectionOptions,
          fields: totalCount
            ? (
                t: PothosSchemaTypes.ObjectFieldBuilder<
                  SchemaTypes,
                  { totalCount?: () => MaybePromise<number> }
                >,
              ) => ({
                totalCount: t.int({
                  nullable: false,
                  extensions: {
                    pothosPrismaTotalCount: true,
                  },
                  resolve: (parent) => parent.totalCount?.(),
                }),
                ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
              })
            : (connectionOptions as { fields: undefined }).fields,
        },
    edgeOptions,
  );

  return fieldRef;
} as never;

function checkIfQueryIsUsed<Types extends SchemaTypes, T>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  query: object,
  info: GraphQLResolveInfo,
  result: T,
): T {
  const { onUnusedQuery } = builder.options.prisma || {};
  if (!onUnusedQuery) {
    return result;
  }

  if (isThenable(result)) {
    return result.then((resolved) => {
      if (!isUsed(query)) {
        onUnused();
      }

      return resolved;
    }) as T;
  }

  if (!isUsed(query)) {
    onUnused();
  }

  return result;

  function onUnused() {
    if (typeof onUnusedQuery === 'function') {
      onUnusedQuery(info);
      return;
    }

    const message = `Prisma query was unused in resolver for ${info.parentType.name}.${info.fieldName}`;

    if (onUnusedQuery === 'error') {
      throw new PothosError(message);
    }
    if (onUnusedQuery === 'warn') {
      console.warn(message);
    }
  }
}
