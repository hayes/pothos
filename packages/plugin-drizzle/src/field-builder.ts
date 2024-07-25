import { getNamedType, GraphQLResolveInfo, isInterfaceType, isObjectType, Kind } from 'graphql';
import { FieldKind, MaybePromise, ObjectRef, RootFieldBuilder, SchemaTypes } from '@pothos/core';
import { queryFromInfo } from './utils/map-query';
import { getRefFromModel } from './utils/refs';
import { FieldRef } from '@pothos/core';
import { DrizzleRef } from './interface-ref';
import { DrizzleConnectionFieldOptions } from './types';
import { getOperators, TableRelationalConfig } from 'drizzle-orm';
import { getCursorFormatter, resolveDrizzleCursorConnection } from './utils/cursors';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.drizzleField = function drizzleField({ type, resolve, ...options }) {
  const modelOrRef = Array.isArray(type) ? type[0] : type;
  const typeRef =
    // typeof modelOrRef === 'string' ?
    getRefFromModel(modelOrRef as string, this.builder);
  // : (modelOrRef as ObjectRef<SchemaTypes, unknown>);
  const typeParam = Array.isArray(type)
    ? ([typeRef] as [ObjectRef<SchemaTypes, unknown>])
    : typeRef;
  return this.field({
    ...(options as {}),
    type: typeParam,
    resolve: (parent: unknown, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      const query = queryFromInfo({
        schema: this.builder.options.drizzle.client._.schema!,
        context,
        info,
        // withUsageCheck: !!this.builder.options.drizzle?.onUnusedQuery,
      });

      return resolve(query, parent, args as never, context, info) as never;
    },
  }) as never;
};

const ops = getOperators();

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
    query,
    resolve,
    // totalCount,
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
        const { orderBy, where, ...select } =
          (typeof query === 'function' ? query(args, context) : query) ?? {};

        const drizzleModel =
          this.builder.options.drizzle.client._.schema?.[
            typeof type === 'string' ? type : (ref as DrizzleRef<SchemaTypes>).tableName
          ]!;

        const queryObj = queryFromInfo({
          context,
          info,
          select,
          paths: [['nodes'], ['edges', 'node']],
          typeName,
          schema: this.builder.options.drizzle.client._.schema!,
          // withUsageCheck: !!this.builder.options.prisma?.onUnusedQuery,
        });

        // const returnType = getNamedType(info.returnType);
        // const fields =
        //   isObjectType(returnType) || isInterfaceType(returnType) ? returnType.getFields() : {};

        // const selections = info.fieldNodes;

        // const totalCountOnly = selections.every(
        //   (selection) =>
        //     selection.selectionSet?.selections.length === 1 &&
        //     selection.selectionSet.selections.every(
        //       (s) =>
        //         s.kind === Kind.FIELD && fields[s.name.value]?.extensions?.pothosPrismaTotalCount,
        //     ),
        // );

        return resolveDrizzleCursorConnection(
          {
            parent,
            query: queryObj,
            orderBy:
              typeof orderBy === 'function'
                ? orderBy(drizzleModel.columns)
                : orderBy ?? drizzleModel.primaryKey,
            where: typeof where === 'function' ? where(drizzleModel.columns, ops) : undefined,
            ctx: context,
            maxSize,
            defaultSize,
            args,
            // totalCount: totalCount && (() => totalCount(parent, args as never, context, info)),
          },

          (q) => {
            // if (totalCountOnly) return [];

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
          fields:
            // totalCount
            //   ? (
            //       t: PothosSchemaTypes.ObjectFieldBuilder<
            //         SchemaTypes,
            //         { totalCount?: () => MaybePromise<number> }
            //       >,
            //     ) => ({
            //       totalCount: t.int({
            //         nullable: false,
            //         extensions: {
            //           pothosPrismaTotalCount: true,
            //         },
            //         resolve: (parent, args, context) => parent.totalCount?.(),
            //       }),
            //       ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
            //     }) :
            (connectionOptions as { fields: undefined }).fields,
          extensions: {
            ...(connectionOptions as Record<string, {}> | undefined)?.extensions,
          },
        },
    edgeOptions,
  );

  return fieldRef;
} as never;
