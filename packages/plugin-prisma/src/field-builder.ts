import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldRef,
  InputFieldMap,
  ObjectRef,
  RootFieldBuilder,
  SchemaTypes,
} from '@pothos/core';
import { PrismaConnectionFieldOptions, PrismaModelTypes } from './types';
import { resolvePrismaCursorConnection } from './util/cursors';
import { getCursorFormatter, getCursorParser, getRefFromModel } from './util/datamodel';
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
    ...options,
    type: typeParam,
    resolve: (parent: unknown, args: unknown, ctx: {}, info: GraphQLResolveInfo) => {
      const query = queryFromInfo(ctx, info);

      return resolve(query, parent, args as never, ctx, info) as never;
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
  connectionOptions: {},
  edgeOptions: {},
) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this.builder) : type;
  const typeName = this.builder.configStore.getTypeConfig(ref).name;

  const model = this.builder.configStore.getTypeConfig(ref).extensions?.pothosPrismaModel as string;

  const formatCursor = getCursorFormatter(model, this.builder, cursor);
  const parseCursor = getCursorParser(model, this.builder, cursor);

  const fieldRef = (
    this as typeof fieldBuilderProto & { connection: (...args: unknown[]) => FieldRef<unknown> }
  ).connection(
    {
      ...options,
      type: ref,
      resolve: (
        parent: unknown,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        ctx: {},
        info: GraphQLResolveInfo,
      ) =>
        resolvePrismaCursorConnection(
          {
            query: queryFromInfo(ctx, info),
            parseCursor,
            maxSize,
            defaultSize,
            args,
          },
          formatCursor,
          (query) => resolve(query as never, parent, args as never, ctx, info),
        ),
    },
    {
      ...connectionOptions,
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
