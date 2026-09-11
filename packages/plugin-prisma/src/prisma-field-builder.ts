import {
  type CompatibleTypes,
  completeValue,
  type ExposeNullability,
  type FieldKind,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  type InterfaceParam,
  isThenable,
  type MaybePromise,
  type NormalizeArgs,
  ObjectRef,
  type PluginName,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import { type SelectedFieldNode, selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaRef } from './interface-ref.js';
import { ModelLoader } from './model-loader.js';
import type {
  PrismaConnectionShape,
  PrismaModelTypes,
  RelatedConnectionOptions,
  RelatedFieldOptions,
  RelationCountOptions,
  SelectionMap,
  ShapeFromConnection,
  TypesForRelation,
  VariantFieldOptions,
} from './types.js';
import {
  getCursorFormatter,
  getCursorParser,
  prismaCursorConnectionQuery,
  wrapConnectionResult,
} from './util/cursors.js';
import { getRefFromModel, getRelation } from './util/datamodel.js';
import { getFieldDescription } from './util/description.js';

import type { FieldMap } from './util/relation-map.js';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

type ContextForAuth<Types extends SchemaTypes, Scopes extends {} = {}> =
  PothosSchemaTypes.ScopeAuthContextForAuth<Types, Scopes> extends {
    Context: infer T;
  }
    ? T extends object
      ? T
      : object
    : object;

type FieldAuthScopes<Types extends SchemaTypes, Parent, Args extends {} = {}> =
  PothosSchemaTypes.ScopeAuthFieldAuthScopes<Types, Parent, Args> extends {
    Scopes: infer T;
  }
    ? T
    : never;

export class PrismaObjectFieldBuilder<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Shape extends object = Model['Shape'],
> extends RootBuilder<Types, Shape, 'PrismaObject'> {
  model: string;

  prismaFieldMap: FieldMap;

  exposeBoolean = this.createExpose('Boolean');

  exposeFloat = this.createExpose('Float');

  exposeInt = this.createExpose('Int');

  exposeID = this.createExpose('ID');

  exposeString = this.createExpose('String');

  exposeBooleanList = this.createExpose(['Boolean']);

  exposeFloatList = this.createExpose(['Float']);

  exposeIntList = this.createExpose(['Int']);

  exposeIDList = this.createExpose(['ID']);

  exposeStringList = this.createExpose(['String']);

  withAuth: 'scopeAuth' extends PluginName
    ? <Scopes extends FieldAuthScopes<Types, Shape, Record<string, unknown>>>(
        scopes: Scopes,
      ) => PothosSchemaTypes.PrismaObjectFieldBuilder<
        Omit<Types, 'Context'> & { Context: ContextForAuth<Types, Scopes> },
        Model,
        Shape
      >
    : '@pothos/plugin-scope-auth is required to use this method' = withAuth as never;

  relatedConnection: 'relay' extends PluginName
    ? <
        Field extends Model['ListRelations'],
        Nullable extends boolean,
        Args extends InputFieldMap,
        const ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        const EdgeInterfaces extends InterfaceParam<Types>[] = [],
        Type = unknown,
        Shape = // biome-ignore lint/suspicious/noExplicitAny: generic match
        Type extends PrismaRef<any, any>
          ? Type['$inferType']
          : TypesForRelation<Types, Model, Field>['Shape'],
      >(
        field: Field,
        options: RelatedConnectionOptions<Types, Model, Field, Nullable, Args, Type>,
        ...args: NormalizeArgs<
          [
            connectionOptions:
              | ObjectRef<
                  Types,
                  ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, Shape, false>>
                >
              | PothosSchemaTypes.ConnectionObjectOptions<
                  Types,
                  ObjectRef<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>>,
                  false,
                  false,
                  PrismaConnectionShape<
                    Types,
                    ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>,
                    Shape,
                    Args
                  >,
                  ConnectionInterfaces
                >,
            edgeOptions:
              | ObjectRef<
                  Types,
                  {
                    cursor: string;
                    node?: Shape | null | undefined;
                  }
                >
              | PothosSchemaTypes.ConnectionEdgeObjectOptions<
                  Types,
                  ObjectRef<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>>,
                  false,
                  PrismaConnectionShape<
                    Types,
                    ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>,
                    Shape,
                    Args
                  >,
                  EdgeInterfaces
                >,
          ],
          0
        >
      ) => FieldRef<
        Types,
        ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, Shape, Nullable>>
      >
    : '@pothos/plugin-relay is required to use this method' = function relatedConnection(
    this: PrismaObjectFieldBuilder<SchemaTypes, Model>,
    name: string,
    {
      maxSize = this.builder.options.prisma.maxConnectionSize,
      defaultSize = this.builder.options.prisma.defaultConnectionSize,
      cursor: cursorValue,
      query,
      resolve,
      extensions,
      totalCount,
      description,
      ...options
    }: {
      type?: ObjectRef<Types, unknown, unknown>;
      totalCount?: boolean;
      maxSize?: number | ((args: {}, ctx: {}) => number);
      defaultSize?: number | ((args: {}, ctx: {}) => number);
      cursor: string;
      extensions: {};
      description?: string;
      query: ((args: {}, ctx: {}) => {}) | {};
      resolve: (
        query: {},
        parent: unknown,
        args: {},
        ctx: {},
        info: {},
      ) => MaybePromise<readonly {}[]>;
    },
    connectionOptions = {},
    edgeOptions = {},
  ) {
    const relationField = getRelation(this.model, this.builder, name);
    const ref = options.type ?? getRefFromModel(relationField.type, this.builder);
    let typeName: string | undefined;

    const formatCursor = getCursorFormatter(relationField.type, this.builder, cursorValue);
    const parseCursor = getCursorParser(relationField.type, this.builder, cursorValue);

    // The field's `query` may be async, so the result is a promise when it is.
    const getQuery = (args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => {
      const connectionQuery = prismaCursorConnectionQuery({
        parseCursor,
        ctx,
        maxSize,
        defaultSize,
        args,
      });

      const userQuery = (typeof query === 'function' ? query(args, ctx) : query) as
        | MaybePromise<typeof connectionQuery>
        | null
        | undefined;

      return isThenable(userQuery)
        ? (userQuery as PromiseLike<typeof connectionQuery | null | undefined>).then((resolved) =>
            mergeConnectionQuery(resolved, connectionQuery),
          )
        : mergeConnectionQuery(userQuery, connectionQuery);
    };

    const cursorSelection = ModelLoader.getCursorSelection(
      ref as never,
      relationField.type,
      cursorValue,
      this.builder,
    );

    // What the document asks of this connection, read the way the planner reads it (through
    // fragments, directives, and a wrapping type), so the resolve side agrees with the plan. The
    // selection is read once per request and shared by every parent row.
    const connectionSelectionFromNames = (selected: ReadonlySet<string>) => {
      const hasTotalCount = !!totalCount && selected.has('totalCount');
      for (const field of selected) {
        if (field !== 'totalCount' && field !== '__typename') {
          return { hasTotalCount, totalCountOnly: false };
        }
      }
      return { hasTotalCount, totalCountOnly: hasTotalCount };
    };

    const connectionSelection = (context: object, info: GraphQLResolveInfo) => {
      return connectionSelectionFromNames(selectedFieldNames(context, info));
    };

    // Built once per field, so a synchronous plan allocates nothing beyond the map itself.
    const selectConnection = (
      nested: SelectionMap,
      hasTotalCount: boolean,
      totalCountOnly: boolean,
    ) => {
      const countSelect =
        this.builder.options.prisma.filterConnectionTotalCount !== false && nested.where
          ? { where: nested.where }
          : true;

      return {
        select: {
          ...(hasTotalCount ? { _count: { select: { [name]: countSelect } } } : {}),
          [name]: totalCountOnly
            ? undefined
            : nested.select
              ? {
                  ...nested,
                  select: {
                    ...cursorSelection,
                    ...nested.select,
                  },
                }
              : nested,
        },
      };
    };

    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown, path?: unknown) => { select?: object },
      getSelection: SelectedFieldNode,
    ) => {
      typeName ??= this.builder.configStore.getTypeConfig(ref).name;
      // A maybe-promise query starts the nested plan now; its merge waits for the query.
      const nested = nestedQuery(getQuery(args, context), {
        getType: () => typeName!,
        paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
      }) as MaybePromise<SelectionMap>;

      const { hasTotalCount, totalCountOnly } = connectionSelectionFromNames(getSelection());

      return isThenable(nested)
        ? nested.then((resolved) => selectConnection(resolved, hasTotalCount, totalCountOnly))
        : selectConnection(nested, hasTotalCount, totalCountOnly);
    };

    // The loaded path, per parent row: the rows are on the parent, only the page size is needed.
    const resolveLoaded = (
      connectionQuery: { take: number },
      parent: unknown,
      args: PothosSchemaTypes.DefaultConnectionArguments,
      totalCountOnly: boolean,
    ) =>
      wrapConnectionResult(
        parent,
        totalCountOnly ? [] : ((parent as Record<string, never>)[name] ?? []),
        args,
        connectionQuery.take,
        formatCursor,
        (parent as { _count?: Record<string, number> })._count?.[name],
      );

    const resolveFallback =
      resolve &&
      ((
        connectionQuery: {},
        q: { take: number },
        parent: unknown,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        context: {},
        info: GraphQLResolveInfo,
      ) =>
        Promise.resolve(
          resolve({ ...q, ...connectionQuery } as never, parent, args, context, info),
        ).then((result) => wrapConnectionResult(parent, result, args, q.take, formatCursor)));

    const fieldRef = (
      this as unknown as {
        connection: (...args: unknown[]) => FieldRef<Types, unknown>;
      }
    ).connection(
      {
        ...options,
        description: getFieldDescription(this.model, this.builder, name, description),
        extensions: {
          ...extensions,
          pothosPrismaRelationField: relationField,
          pothosPrismaSelect: relationSelect,
          pothosPrismaLoaded: (
            value: Record<string, unknown>,
            info: GraphQLResolveInfo,
            context: object,
          ) => {
            const { hasTotalCount, totalCountOnly } = connectionSelection(context, info);

            return (
              (!hasTotalCount ||
                (value as { _count?: Record<string, unknown> })._count?.[name] !== undefined) &&
              (totalCountOnly || value[name] !== undefined)
            );
          },
          pothosPrismaFallback:
            resolveFallback &&
            ((
              q: { take: number },
              parent: unknown,
              args: PothosSchemaTypes.DefaultConnectionArguments,
              context: {},
              info: GraphQLResolveInfo,
            ) => {
              const connectionQuery = getQuery(args, context);

              return isThenable(connectionQuery)
                ? connectionQuery.then((resolved) =>
                    resolveFallback(resolved as {}, q, parent, args, context, info),
                  )
                : resolveFallback(connectionQuery, q, parent, args, context, info);
            }),
        },
        type: ref,
        resolve: (
          parent: unknown,
          args: PothosSchemaTypes.DefaultConnectionArguments,
          context: {},
          info: GraphQLResolveInfo,
        ) => {
          const { totalCountOnly } = connectionSelection(context, info);
          const connectionQuery = getQuery(args, context);

          return isThenable(connectionQuery)
            ? connectionQuery.then((resolved) =>
                resolveLoaded(resolved as { take: number }, parent, args, totalCountOnly),
              )
            : resolveLoaded(connectionQuery, parent, args, totalCountOnly);
        },
      },
      connectionOptions instanceof ObjectRef
        ? connectionOptions
        : {
            ...connectionOptions,
            fields: totalCount
              ? (
                  t: PothosSchemaTypes.ObjectFieldBuilder<SchemaTypes, { totalCount?: number }>,
                ) => ({
                  totalCount: t.int({
                    nullable: false,
                    extensions: {
                      pothosPrismaTotalCount: true,
                    },
                    resolve: (parent, _args, _context) => parent.totalCount,
                  }),
                  ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
                })
              : (connectionOptions as { fields: undefined }).fields,
          },
      edgeOptions,
    );

    return fieldRef;
  } as never;

  typename: string;

  constructor(
    typename: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    model: string,
    fieldMap: FieldMap,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind] = 'Object',
  ) {
    super(builder, 'PrismaObject', graphqlKind);

    this.model = model;
    this.prismaFieldMap = fieldMap;
    this.typename = typename;
    this.builder = builder;
  }

  relation<
    Field extends Model['RelationName'],
    Nullable extends boolean,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    name: Field,
    ...allArgs: NormalizeArgs<
      [options: RelatedFieldOptions<Types, Model, Field, Nullable, Args, ResolveReturnShape, Shape>]
    >
  ): FieldRef<Types, Model['Relations'][Field]['Shape'], 'Object'> {
    const [{ description, ...options } = {} as never] = allArgs;
    const relationField = getRelation(this.model, this.builder, name);
    const ref = options.type ?? getRefFromModel(relationField.type, this.builder);

    const { query = {}, resolve, extensions, onNull, ...rest } = options;

    // Built once per field: the select allocates nothing when the nested selection is sync.
    const selectRelation = (nested: unknown) => ({ select: { [name]: nested } });
    const relationSelect = (
      _args: object,
      _context: object,
      nestedQuery: (query: unknown) => unknown,
    ) => completeValue(nestedQuery(query), selectRelation);

    const resolveWithQuery =
      resolve &&
      ((userQuery: {}, q: {}, parent: Shape, args: {}, context: {}, info: GraphQLResolveInfo) =>
        resolve({ ...q, ...userQuery } as never, parent, args as never, context, info));

    return this.field({
      ...(rest as {}),
      type: relationField.isList ? [ref] : ref,
      description: getFieldDescription(this.model, this.builder, name, description),
      extensions: {
        ...extensions,
        pothosPrismaRelationField: relationField,
        pothosPrismaSelect: relationSelect as never,
        pothosPrismaLoaded: (value: Record<string, unknown>) => value[name] !== undefined,
        pothosPrismaFallback:
          resolveWithQuery &&
          ((q: {}, parent: Shape, args: {}, context: {}, info: GraphQLResolveInfo) => {
            const userQuery = typeof query === 'function' ? query(args, context) : query;

            return isThenable(userQuery)
              ? userQuery.then((resolved) =>
                  resolveWithQuery(resolved as {}, q, parent, args, context, info),
                )
              : resolveWithQuery(userQuery, q, parent, args, context, info);
          }),
      },
      resolve: (parent, args, context, info) => {
        const result = (parent as Record<string, never>)[name];

        if (typeof onNull === 'function' && result == null) {
          return onNull(parent, args as never, context, info) as never;
        }

        return result;
      },
    }) as FieldRef<Types, Model['Relations'][Field]['Shape'], 'Object'>;
  }

  relationCount<Field extends Model['ListRelations'], Args extends InputFieldMap>(
    name: Field,
    ...allArgs: NormalizeArgs<
      [
        options: RelationCountOptions<
          Types,
          Shape,
          TypesForRelation<Types, Model, Field>['Where'],
          Args
        >,
      ]
    >
  ): FieldRef<Types, number, 'Object'> {
    const [{ where, ...options } = {} as never] = allArgs;

    const selectCount = (where: {}) => ({ _count: { select: { [name]: { where } } } });
    const countSelect =
      typeof where === 'function'
        ? (args: {}, context: {}) =>
            completeValue(
              (where as (args: unknown, ctx: unknown) => MaybePromise<{}>)(args, context),
              selectCount,
            )
        : {
            _count: {
              select: { [name]: where ? { where } : true },
            },
          };

    return this.field({
      ...(options as {}),
      type: 'Int',
      nullable: false,
      select: countSelect as never,
      resolve: (parent, _args, _context, _info) =>
        (parent as unknown as { _count: Record<string, never> })._count?.[name],
    }) as FieldRef<Types, number, 'Object'>;
  }

  variant<
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    Variant extends Model['Name'] | PrismaRef<any, Model>,
    Args extends InputFieldMap,
    Nullable,
  >(
    variant: Variant,
    ...allArgs: NormalizeArgs<
      [
        options: VariantFieldOptions<
          Types,
          Model,
          // biome-ignore lint/suspicious/noExplicitAny: this is fine
          Variant extends PrismaRef<any, Model> ? Variant : PrismaRef<Types, Model>,
          Args,
          Nullable,
          Shape
        >,
      ]
    >
  ): FieldRef<Types, Model['Shape'], 'Object'> {
    const [{ isNull, nullable, ...options } = {} as never] = allArgs;
    const ref: PrismaRef<Types, PrismaModelTypes> =
      typeof variant === 'string' ? getRefFromModel(variant, this.builder) : variant;

    const selfSelect = (
      _args: object,
      _context: object,
      nestedQuery: (query: unknown) => unknown,
    ) => nestedQuery({});

    return this.field({
      ...(options as {}),
      type: ref,
      extensions: {
        ...options?.extensions,
        pothosPrismaSelect: selfSelect,
      },
      nullable: nullable ?? !!isNull,
      resolve: isNull
        ? (parent, args, context, info) => {
            const parentIsNull = isNull(parent, args as never, context, info);
            if (parentIsNull) {
              if (isThenable(parentIsNull)) {
                return parentIsNull.then((resolved) => (resolved ? null : parent)) as never;
              }
              return null as never;
            }
            return parent as never;
          }
        : (parent) => parent as never,
    }) as FieldRef<Types, Model['Shape'], 'Object'>;
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends CompatibleTypes<Types, Model['Shape'], Type, true>,
  >(
    name: Name,
    ...args: NormalizeArgs<
      [
        options: ExposeNullability<Types, Type, Model['Shape'], Name, Nullable> &
          Omit<
            PothosSchemaTypes.ObjectFieldOptions<
              Types,
              Shape,
              Type,
              Nullable,
              {},
              ResolveReturnShape
            >,
            'description' | 'nullable' | 'select' | InferredFieldOptionKeys
          > & {
            description?: string | false;
          },
      ]
    >
  ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'PrismaObject'> {
    const [options = {} as never] = args;

    const typeConfig = this.builder.configStore.getTypeConfig(this.typename);
    const usingSelect = !!typeConfig.extensions?.pothosPrismaSelect;

    return this.exposeField<Type, Nullable, never>(name as never, {
      ...options,
      description: getFieldDescription(
        this.model,
        this.builder,
        name as string,
        options.description,
      ) as never,
      extensions: {
        ...options.extensions,
        pothosPrismaVariant: name,
        pothosPrismaSelect: usingSelect && {
          [name as string]: true,
        },
      },
    });
  }

  private createExpose<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      ResolveReturnShape,
      Name extends CompatibleTypes<
        Types,
        Model['Shape'],
        Type,
        Type extends [unknown] ? { list: true; items: true } : true
      >,
    >(
      name: Name,
      ...args: NormalizeArgs<
        [
          options: ExposeNullability<Types, Type, Model['Shape'], Name, Nullable> &
            Omit<
              PothosSchemaTypes.ObjectFieldOptions<
                Types,
                Shape,
                Type,
                Nullable,
                {},
                ResolveReturnShape
              >,
              'description' | 'nullable' | 'select' | 'type' | InferredFieldOptionKeys
            > & {
              description?: string | false;
            },
        ]
      >
    ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'PrismaObject'> => {
      const [options = {} as never] = args;

      return this.expose<Type, Nullable, ResolveReturnShape, never>(
        name as never,
        {
          ...options,
          type,
        } as never,
      );
    };
  }
}

/** The field's `query` under the cursor arguments; its own `take`/`skip`/`cursor` win. */
function mergeConnectionQuery<Q extends { take: number; skip: number; cursor?: unknown }>(
  userQuery: Q | null | undefined,
  connectionQuery: Q,
): Q {
  const {
    take = connectionQuery.take,
    skip = connectionQuery.skip,
    cursor = connectionQuery.cursor,
    ...fieldQuery
  } = userQuery ?? ({} as Q);

  return {
    ...fieldQuery,
    ...connectionQuery,
    take,
    skip,
    ...(cursor ? { cursor } : {}),
  } as Q;
}

/** A field builder of the same type whose fields all carry `scopes`. */
function withAuth(this: PrismaObjectFieldBuilder<SchemaTypes, PrismaModelTypes, {}>, scopes: {}) {
  const builder = new PrismaObjectFieldBuilder(
    this.typename,
    this.builder,
    this.model,
    this.prismaFieldMap,
  ) as unknown as { createField: (options: Record<string, unknown>) => unknown };
  const originalCreateField = builder.createField;

  builder.createField = function createField(options) {
    return originalCreateField.call(this, { authScopes: scopes, ...options });
  };

  return builder as never;
}
