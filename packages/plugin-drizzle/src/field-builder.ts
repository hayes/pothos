import type { FieldRef, MaybePromise } from '@pothos/core';
import {
  type FieldKind,
  isThenable,
  ObjectRef,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import { isInterfaceType, isObjectType, Kind } from 'graphql';
import type { DrizzleRef } from './interface-ref.js';
import type { DrizzleConnectionFieldOptions } from './types.js';
import type { DrizzlePlan } from './utils/adapter.js';
import { getSchemaConfig, type PothosDrizzleSchemaConfig } from './utils/config.js';
import { resolveDrizzleCursorConnection } from './utils/cursors.js';
import { planFromInfo, queryFromPlan } from './utils/map-query.js';
import { getRefFromModel } from './utils/refs.js';
import type { SelectionMap } from './utils/selections.js';

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
      const config = getSchemaConfig(this.builder);
      // A promise while a selection beneath the field is async: the resolver runs once it has
      // settled, so the builder it is handed never returns one.
      const plan = planFromInfo({ config, context, info });

      return isThenable(plan)
        ? plan.then((settled) =>
            resolveWithWalk(
              config,
              resolve as never,
              settled as DrizzlePlan | undefined,
              parent,
              args,
              context,
              info,
            ),
          )
        : resolveWithWalk(config, resolve as never, plan, parent, args, context, info);
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
      const config = getSchemaConfig(this.builder);
      const plan = planFromInfo({ config, context, info });

      return isThenable(plan)
        ? plan.then((settled) =>
            resolveWithWalk(
              config,
              resolve,
              settled as DrizzlePlan | undefined,
              parent,
              args,
              context,
              info,
            ),
          )
        : resolveWithWalk(config, resolve, plan, parent, args, context, info);
    },
  }) as never;
} as never;

/**
 * Runs a `drizzleField` resolver with a builder over its settled plan; built once so a
 * synchronous plan allocates nothing but the builder itself.
 */
function resolveWithWalk(
  config: PothosDrizzleSchemaConfig,
  resolve: (...args: unknown[]) => unknown,
  plan: DrizzlePlan | undefined,
  parent: unknown,
  args: unknown,
  context: {},
  info: GraphQLResolveInfo,
) {
  return resolve(
    (select?: SelectionMap) =>
      queryFromPlan(plan, {
        config,
        context,
        select,
        info,
      }),
    parent,
    args,
    context,
    info,
  );
}

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

  // Built once per field: resolving with a synchronous plan allocates nothing beyond the
  // callback `resolveDrizzleCursorConnection` was already handed.
  const resolveConnection = (
    plan: DrizzlePlan | undefined,
    parent: unknown,
    args: PothosSchemaTypes.DefaultConnectionArguments,
    context: {},
    info: GraphQLResolveInfo,
    totalCountOnly: boolean,
  ) =>
    resolveDrizzleCursorConnection(
      tableName,
      info,
      plan,
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

        // Planned before the resolver runs, so the builder it is handed is synchronous even when
        // a selection beneath the connection is async.
        const plan = planFromInfo({
          config: getSchemaConfig(this.builder),
          context,
          info,
          paths: [['nodes'], ['edges', 'node']],
          typeName,
        });

        return isThenable(plan)
          ? plan.then((settled) =>
              resolveConnection(
                settled as DrizzlePlan | undefined,
                parent,
                args,
                context,
                info,
                totalCountOnly,
              ),
            )
          : resolveConnection(plan, parent, args, context, info, totalCountOnly);
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
