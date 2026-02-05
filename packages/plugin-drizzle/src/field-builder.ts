import type { FieldRef, MaybePromise } from '@pothos/core';
import { type FieldKind, ObjectRef, RootFieldBuilder, type SchemaTypes } from '@pothos/core';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import { isInterfaceType, isObjectType, Kind } from 'graphql';
import type { DrizzleRef } from './interface-ref';
import type { DrizzleConnectionFieldOptions } from './types';
import { getSchemaConfig } from './utils/config';
import { resolveDrizzleCursorConnection } from './utils/cursors';
import { queryFromInfo } from './utils/map-query';
import { getRefFromModel } from './utils/refs';
import type { SelectionMap } from './utils/selections';

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
    resolve: async (parent: unknown, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      let queryCalled = false;
      const queryFn = (select?: SelectionMap) => {
        queryCalled = true;
        return queryFromInfo({
          config: getSchemaConfig(this.builder),
          context,
          select,
          info,
          // withUsageCheck: !!this.builder.options.drizzle?.onUnusedQuery,
        }) as never;
      };

      const result = await resolve(queryFn, parent, args as never, context, info);

      // If the query function was not called, we still need to set the loader mappings
      if (!queryCalled) {
        queryFromInfo({
          config: getSchemaConfig(this.builder),
          context,
          info,
        });
      }

      return result as never;
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
    resolve: async (parent: unknown, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      let queryCalled = false;
      const queryFn = (select?: SelectionMap) => {
        queryCalled = true;
        return queryFromInfo({
          config: getSchemaConfig(this.builder),
          context,
          select,
          info,
          // withUsageCheck: !!this.builder.options.drizzle?.onUnusedQuery,
        });
      };

      const result = await resolve(queryFn, parent, args as never, context, info);

      // If the query function was not called, we still need to set the loader mappings
      if (!queryCalled) {
        queryFromInfo({
          config: getSchemaConfig(this.builder),
          context,
          info,
        });
      }

      return result as never;
    },
  }) as never;
} as never;

fieldBuilderProto.drizzleConnection = function drizzleConnection<
  Type extends
    | DrizzleRef<SchemaTypes, keyof SchemaTypes['DrizzleRelations']['config']>
    | keyof SchemaTypes['DrizzleRelations']['config'],
  Nullable extends boolean,
  ResolveReturnShape,
>(
  this: typeof fieldBuilderProto,
  {
    type,
    maxSize = this.builder.options.drizzle?.maxConnectionSize,
    defaultSize = this.builder.options.drizzle?.defaultConnectionSize,
    resolve,
    totalCount,
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
  const tableName = typeof type === 'string' ? type : (ref as DrizzleRef<SchemaTypes>).tableName;
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
        const returnType = info.returnType;
        const fields =
          isObjectType(returnType) || isInterfaceType(returnType) ? returnType.getFields() : {};

        const selections = info.fieldNodes;

        const totalCountOnly = selections.every((selection) =>
          selection.selectionSet?.selections.every(
            (s) =>
              s.kind === Kind.FIELD &&
              (fields[s.name.value]?.extensions?.pothosDrizzleTotalCount ||
                s.name.value === '__typename'),
          ),
        );

        return resolveDrizzleCursorConnection(
          tableName,
          info,
          typeName,
          getSchemaConfig(this.builder),
          {
            ctx: context,
            maxSize,
            defaultSize,
            args,
            totalCount: totalCount && (() => totalCount(parent, args as never, context, info)),
          },
          (q) => {
            if (totalCountOnly) {
              return [];
            }

            // return checkIfQueryIsUsed(
            //   this.builder,
            //   query,
            //   info,
            return resolve(q as never, parent, args as never, context, info) as never;
            // );
          },
          parent,
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
                    pothosDrizzleTotalCount: true,
                  },
                  resolve: (parent) => parent.totalCount?.(),
                }),
                ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
              })
            : (connectionOptions as { fields: undefined }).fields,
          extensions: {
            ...(connectionOptions as Record<string, object> | undefined)?.extensions,
          },
        },
    edgeOptions,
  );

  return fieldRef;
} as never;
