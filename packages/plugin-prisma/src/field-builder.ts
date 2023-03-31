import { getNamedType, GraphQLResolveInfo, isInterfaceType, isObjectType, Kind } from 'graphql';
import {
  FieldKind,
  FieldRef,
  InputFieldMap,
  isThenable,
  MaybePromise,
  ObjectRef,
  PothosError,
  RootFieldBuilder,
  SchemaTypes,
} from '@pothos/core';
import { ModelLoader } from './model-loader';
import { PrismaConnectionFieldOptions, PrismaModelTypes } from './types';
import { getCursorFormatter, getCursorParser, resolvePrismaCursorConnection } from './util/cursors';
import { getRefFromModel } from './util/datamodel';
import { queryFromInfo } from './util/map-query';
import { isUsed } from './util/usage';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.prismaField = function prismaField({ type, resolve, ...options }) {
  const modelOrRef = Array.isArray(type) ? type[0] : type;
  const typeRef =
    typeof modelOrRef === 'string'
      ? getRefFromModel(modelOrRef, this.builder)
      : (modelOrRef as ObjectRef<SchemaTypes, unknown>);
  const typeParam = Array.isArray(type)
    ? ([typeRef] as [ObjectRef<SchemaTypes, unknown>])
    : typeRef;
  return this.field({
    ...(options as {}),
    type: typeParam,
    resolve: (parent: never, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      const query = queryFromInfo({
        context,
        info,
        withUsageCheck: !!this.builder.options.prisma?.onUnusedQuery,
      });

      return checkIfQueryIsUsed(
        this.builder,
        query,
        info,
        resolve(query, parent, args as never, context, info) as never,
      );
    },
  }) as never;
};

fieldBuilderProto.prismaFieldWithInput = function prismaFieldWithInput({
  type,
  resolve,
  ...options
}) {
  const modelOrRef = Array.isArray(type) ? type[0] : type;
  const typeRef =
    typeof modelOrRef === 'string'
      ? getRefFromModel(modelOrRef, this.builder)
      : (modelOrRef as ObjectRef<SchemaTypes, unknown>);
  const typeParam = Array.isArray(type)
    ? ([typeRef] as [ObjectRef<SchemaTypes, unknown>])
    : typeRef;
  return (
    this as typeof fieldBuilderProto & { fieldWithInput: typeof fieldBuilderProto.field }
  ).fieldWithInput({
    ...(options as {}),
    type: typeParam,
    resolve: (parent: never, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      const query = queryFromInfo({
        context,
        info,
        withUsageCheck: !!this.builder.options.prisma?.onUnusedQuery,
      });

      return checkIfQueryIsUsed(
        this.builder,
        query,
        info,
        resolve(query, parent, args as never, context, info) as never,
      );
    },
  }) as never;
};

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
  const typeName = this.builder.configStore.getTypeConfig(ref).name;
  const model = this.builder.configStore.getTypeConfig(ref).extensions?.pothosPrismaModel as string;
  const formatCursor = getCursorFormatter(model, this.builder, cursor);
  const parseCursor = getCursorParser(model, this.builder, cursor);
  const cursorSelection = ModelLoader.getCursorSelection(ref, model, cursor, this.builder);
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
        const query = queryFromInfo({
          context,
          info,
          select: cursorSelection as {},
          paths: [['nodes'], ['edges', 'node']],
          typeName,
          withUsageCheck: !!this.builder.options.prisma?.onUnusedQuery,
        });

        const returnType = getNamedType(info.returnType);
        const fields =
          isObjectType(returnType) || isInterfaceType(returnType) ? returnType.getFields() : {};

        const selections = info.fieldNodes;

        const totalCountOnly = selections.every(
          (selection) =>
            selection.selectionSet?.selections.length === 1 &&
            selection.selectionSet.selections.every(
              (s) =>
                s.kind === Kind.FIELD && fields[s.name.value]?.extensions?.pothosPrismaTotalCount,
            ),
        );

        return resolvePrismaCursorConnection(
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
            if (totalCountOnly) return [];

            return checkIfQueryIsUsed(
              this.builder,
              query,
              info,
              resolve(q as never, parent, args as never, context, info) as never,
            );
          },
        );
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
                  resolve: (parent, args, context) => parent.totalCount?.(),
                }),
                ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
              })
            : (connectionOptions as { fields: undefined }).fields,
          extensions: {
            ...(connectionOptions as Record<string, {}> | undefined)?.extensions,
          },
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
    } else if (onUnusedQuery === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(message);
    }
  }
}
