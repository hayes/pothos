import { type FieldKind, ObjectRef, RootFieldBuilder, type SchemaTypes } from '@pothos/core';
import type { FieldRef } from '@pothos/core';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import type { DrizzleRef } from './interface-ref';
import type { DrizzleConnectionFieldOptions } from './types';
import { getSchemaConfig } from './utils/config';
import { resolveDrizzleCursorConnection } from './utils/cursors';
import { queryFromInfo } from './utils/map-query';
import { getRefFromModel } from './utils/refs';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.drizzleField = function drizzleField({ type, resolve, ...options }) {
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
    resolve: (parent: unknown, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      return resolve(
        (select) =>
          queryFromInfo({
            config: getSchemaConfig(this.builder),
            context,
            select,
            info,
            // withUsageCheck: !!this.builder.options.drizzle?.onUnusedQuery,
          }),
        parent,
        args as never,
        context,
        info,
      ) as never;
    },
  }) as never;
};

fieldBuilderProto.drizzleFieldWithInput = function drizzleFieldWithInput(
  this: typeof fieldBuilderProto,
  {
    type,
    resolve,
    ...options
  }: { type: ObjectRef<SchemaTypes, unknown> | [string]; resolve: (...args: unknown[]) => unknown },
) {
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
    resolve: (parent: unknown, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      const query = queryFromInfo({
        config: getSchemaConfig(this.builder),
        context,
        info,
        // withUsageCheck: !!this.builder.options.drizzle?.onUnusedQuery,
      });

      return resolve(query, parent, args as never, context, info) as never;
    },
  });
} as never;

fieldBuilderProto.drizzleConnection = function drizzleConnection<
  Type extends
    | DrizzleRef<SchemaTypes, keyof SchemaTypes['DrizzleRelationSchema']>
    | keyof SchemaTypes['DrizzleRelationSchema'],
  Nullable extends boolean,
  ResolveReturnShape,
>(
  this: typeof fieldBuilderProto,
  {
    type,
    maxSize = this.builder.options.drizzle?.maxConnectionSize,
    defaultSize = this.builder.options.drizzle?.defaultConnectionSize,
    resolve,
    ...options
  }: DrizzleConnectionFieldOptions<
    SchemaTypes,
    unknown,
    Type,
    TableRelationalConfig,
    ObjectRef<SchemaTypes, {}>,
    Nullable,
    {},
    ResolveReturnShape,
    FieldKind
  >,
  connectionOptions: {} = {},
  edgeOptions: {} = {},
) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this.builder) : type;
  const typeName = this.builder.configStore.getTypeConfig(ref).name;
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
        const drizzleModel = getSchemaConfig(this.builder).schema?.[
          typeof type === 'string' ? type : (ref as DrizzleRef<SchemaTypes>).tableName
        ]!;

        return resolveDrizzleCursorConnection(
          drizzleModel,
          info,
          typeName,
          getSchemaConfig(this.builder),
          {
            ctx: context,
            maxSize,
            defaultSize,
            args,
          },

          (q) => {
            // return checkIfQueryIsUsed(
            //   this.builder,
            //   query,
            //   info,
            return resolve(q as never, parent, args as never, context, info) as never;
            // );
          },
        );
      },
    },
    connectionOptions instanceof ObjectRef
      ? connectionOptions
      : {
          ...connectionOptions,
          extensions: {
            ...(connectionOptions as Record<string, object> | undefined)?.extensions,
          },
        },
    edgeOptions,
  );

  return fieldRef;
} as never;
