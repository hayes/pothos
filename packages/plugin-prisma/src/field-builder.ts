import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldRef,
  InputFieldMap,
  MaybePromise,
  ObjectRef,
  RootFieldBuilder,
  SchemaTypes,
} from '@pothos/core';
import { ModelLoader } from './model-loader';
import { PrismaConnectionFieldOptions, PrismaModelTypes } from './types';
import { getCursorFormatter, getCursorParser, resolvePrismaCursorConnection } from './util/cursors';
import { getRefFromModel } from './util/datamodel';
import { queryFromInfo } from './util/map-query';

export * from './prisma-field-builder';

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
      : (modelOrRef as ObjectRef<unknown>);
  const typeParam = Array.isArray(type) ? ([typeRef] as [ObjectRef<unknown>]) : typeRef;

  return this.field({
    ...(options as {}),
    type: typeParam,
    resolve: (parent: never, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      const query = queryFromInfo({ context, info });

      return resolve(query, parent, args as never, context, info) as never;
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
    maxSize,
    defaultSize,
    resolve,
    totalCount,
    ...options
  }: PrismaConnectionFieldOptions<
    SchemaTypes,
    unknown,
    Type,
    Model,
    ObjectRef<{}>,
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
    this as typeof fieldBuilderProto & { connection: (...args: unknown[]) => FieldRef<unknown> }
  ).connection(
    {
      ...options,
      type: ref,
      resolve: (
        parent: unknown,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        context: {},
        info: GraphQLResolveInfo,
      ) =>
        resolvePrismaCursorConnection(
          {
            query: queryFromInfo({
              context,
              info,
              select: cursorSelection as {},
            }),
            ctx: context,
            parseCursor,
            maxSize,
            defaultSize,
            args,
            totalCount: totalCount && (() => totalCount(parent, args as never, context, info)),
          },
          formatCursor,
          (query) => resolve(query as never, parent, args as never, context, info),
        ),
    },
    {
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
              resolve: (parent, args, context) => parent.totalCount?.(),
            }),
            ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
          })
        : (connectionOptions as { fields: undefined }).fields,
      extensions: {
        ...(connectionOptions as Record<string, {}> | undefined)?.extensions,
        pothosPrismaIndirectInclude: {
          getType: () => typeName,
          path: [{ name: 'edges' }, { name: 'node' }],
        },
      },
    },
    edgeOptions,
  );

  return fieldRef;
} as never;
