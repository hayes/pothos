import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldRef,
  InputFieldMap,
  ObjectRef,
  RootFieldBuilder,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { resolvePrismaCursorConnection } from './cursors';
import { getRefFromModel } from './refs';
import { PrismaConnectionFieldOptions, PrismaModelTypes } from './types';
import { queryFromInfo } from './util';

export * from './prisma-field-builder';

const fieldBuilderProto = RootFieldBuilder.prototype as GiraphQLSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.prismaField = function prismaField({ type, resolve, ...options }) {
  const model: string = Array.isArray(type) ? type[0] : type;
  const typeRef = getRefFromModel(model, this.builder);
  const typeParam: TypeParam<SchemaTypes> = Array.isArray(type) ? [typeRef] : typeRef;

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
  const ref = getRefFromModel(type, this.builder);
  let typeName: string | undefined;

  const fieldRef = (
    this as typeof fieldBuilderProto & { connection: (...args: unknown[]) => FieldRef<unknown> }
  ).connection(
    {
      ...options,
      type: ref,
      resolve: (
        parent: unknown,
        args: GiraphQLSchemaTypes.DefaultConnectionArguments,
        ctx: {},
        info: GraphQLResolveInfo,
      ) =>
        resolvePrismaCursorConnection(
          {
            query: queryFromInfo(ctx, info),
            column: cursor,
            maxSize,
            defaultSize,
            args,
          },
          (query) => resolve(query as never, parent, args as never, ctx, info),
        ),
    },
    {
      ...connectionOptions,
      extensions: {
        ...(connectionOptions as Record<string, {}> | undefined)?.extensions,
        giraphQLPrismaIndirectInclude: {
          getType: () => {
            if (!typeName) {
              typeName = this.builder.configStore.getTypeConfig(ref).name;
            }

            return typeName;
          },
          path: [{ name: 'edges' }, { name: 'node' }],
        },
      },
    },
    edgeOptions,
  );

  return fieldRef;
} as never;
