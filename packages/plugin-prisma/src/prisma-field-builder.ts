import {
  type CompatibleTypes,
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
import {
  type FieldNode,
  Kind as GraphQLKind,
  type GraphQLResolveInfo,
  getNamedType,
  isInterfaceType,
  isObjectType,
} from 'graphql';
import type { PrismaRef } from './interface-ref';
import { ModelLoader } from './model-loader';
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
} from './types';
import {
  getCursorFormatter,
  getCursorParser,
  prismaCursorConnectionQuery,
  wrapConnectionResult,
} from './util/cursors';
import { getRefFromModel, getRelation } from './util/datamodel';
import { getFieldDescription } from './util/description';
import type { FieldMap } from './util/relation-map';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

type ContextForAuth<
  Types extends SchemaTypes,
  Scopes extends {} = {},
> = PothosSchemaTypes.ScopeAuthContextForAuth<Types, Scopes> extends {
  Context: infer T;
}
  ? T extends object
    ? T
    : object
  : object;

type FieldAuthScopes<
  Types extends SchemaTypes,
  Parent,
  Args extends {} = {},
> = PothosSchemaTypes.ScopeAuthFieldAuthScopes<Types, Parent, Args> extends {
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

    const getQuery = (args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => {
      const connectionQuery = prismaCursorConnectionQuery({
        parseCursor,
        ctx,
        maxSize,
        defaultSize,
        args,
      });

      const {
        take = connectionQuery.take,
        skip = connectionQuery.skip,
        cursor = connectionQuery.cursor,
        ...fieldQuery
      } = ((typeof query === 'function' ? query(args, ctx) : query) ??
        {}) as typeof connectionQuery;

      return {
        ...fieldQuery,
        ...connectionQuery,
        take,
        skip,
        ...(cursor ? { cursor } : {}),
      };
    };

    const cursorSelection = ModelLoader.getCursorSelection(
      ref as never,
      relationField.type,
      cursorValue,
      this.builder,
    );

    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown, path?: unknown) => { select?: object },
      getSelection: (path: string[]) => FieldNode | null,
    ) => {
      typeName ??= this.builder.configStore.getTypeConfig(ref).name;
      const nested = nestedQuery(getQuery(args, context), {
        getType: () => typeName!,
        paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
      }) as SelectionMap;

      const selection = getSelection([])!;
      const hasTotalCount = totalCount && !!getSelection(['totalCount']);

      const selections = selection.selectionSet?.selections.filter(
        (sel) => !(sel.kind === GraphQLKind.FIELD && sel.name.value === '__typename'),
      );
      const totalCountOnly =
        selections?.length === 1 &&
        selections[0].kind === GraphQLKind.FIELD &&
        selections[0].name.value === 'totalCount' &&
        hasTotalCount;

      const countSelect =
        this.builder.options.prisma.filterConnectionTotalCount !== false
          ? nested.where
            ? { where: nested.where }
            : true
          : true;

      return {
        select: {
          ...(hasTotalCount ? { _count: { select: { [name]: countSelect } } } : {}),
          [name]: totalCountOnly
            ? undefined
            : nested?.select
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
          pothosPrismaLoaded: (value: Record<string, unknown>, info: GraphQLResolveInfo) => {
            const returnType = getNamedType(info.returnType);
            const fields =
              isObjectType(returnType) || isInterfaceType(returnType) ? returnType.getFields() : {};

            const selections = info.fieldNodes;

            const totalCountOnly = selections.every((selection) =>
              selection.selectionSet?.selections.every(
                (s) =>
                  s.kind === GraphQLKind.FIELD &&
                  (fields[s.name.value]?.extensions?.pothosPrismaTotalCount ||
                    s.name.value === '__typename'),
              ),
            );

            return totalCountOnly || value[name] !== undefined;
          },
          pothosPrismaFallback:
            resolve &&
            ((
              q: { take: number },
              parent: unknown,
              args: PothosSchemaTypes.DefaultConnectionArguments,
              context: {},
              info: GraphQLResolveInfo,
            ) =>
              Promise.resolve(
                resolve(
                  {
                    ...q,
                    ...getQuery(args, context),
                  } as never,
                  parent,
                  args,
                  context,
                  info,
                ),
              ).then((result) => wrapConnectionResult(parent, result, args, q.take, formatCursor))),
        },
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
          const totalCountOnly = info.fieldNodes.every((selection) =>
            selection.selectionSet?.selections.every(
              (s) =>
                s.kind === GraphQLKind.FIELD &&
                (fields[s.name.value]?.extensions?.pothosPrismaTotalCount ||
                  s.name.value === '__typename'),
            ),
          );

          const connectionQuery = getQuery(args, context);

          return wrapConnectionResult(
            parent,
            totalCountOnly ? [] : ((parent as Record<string, never>)[name] ?? []),
            args,
            connectionQuery.take,
            formatCursor,
            (parent as { _count?: Record<string, number> })._count?.[name],
          );
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

    const relationSelect = (
      _args: object,
      _context: object,
      nestedQuery: (query: unknown) => unknown,
    ) => ({ select: { [name]: nestedQuery(query) } });

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
          resolve &&
          ((q: {}, parent: Shape, args: {}, context: {}, info: GraphQLResolveInfo) =>
            resolve(
              { ...q, ...(typeof query === 'function' ? query(args, context) : query) } as never,
              parent,
              args as never,
              context,
              info,
            )),
      },
      resolve: (parent) => {
        const result = (parent as Record<string, never>)[name];

        if (typeof onNull === 'function' && result == null) {
          return onNull(parent, {} as never, {} as never, {} as never) as never;
        }

        return result;
      },
    }) as FieldRef<Types, Model['Relations'][Field]['Shape'], 'Object'>;
  }

  relationCount<Field extends Model['RelationName'], Args extends InputFieldMap>(
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

    const countSelect =
      typeof where === 'function'
        ? (args: {}, context: {}) => ({
            _count: {
              select: {
                [name]: { where: (where as (args: unknown, ctx: unknown) => {})(args, context) },
              },
            },
          })
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

function addScopes(
  scopes: unknown,
  builder: { createField: (options: Record<string, unknown>) => unknown },
) {
  const originalCreateField = builder.createField;

  builder.createField = function createField(options) {
    return originalCreateField.call(this, {
      authScopes: scopes,
      ...options,
    });
  };

  return builder as never;
}

function withAuth(this: PrismaObjectFieldBuilder<SchemaTypes, PrismaModelTypes, {}>, scopes: {}) {
  return addScopes(
    scopes,
    new PrismaObjectFieldBuilder(
      this.typename,
      this.builder,
      this.model,
      this.prismaFieldMap,
    ) as never,
  );
}
