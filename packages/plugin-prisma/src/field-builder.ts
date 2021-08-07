import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRef,
  InputFieldMap,
  InputFieldsFromShape,
  MaybePromise,
  NormalizeArgs,
  ObjectFieldBuilder,
  ObjectRef,
  PluginName,
  RootFieldBuilder,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import {
  prismaCursorConnectionQuery,
  resolvePrismaCursorConnection,
  wrapConnectionResult,
} from './cursors';
import { getLoaderMapping, setLoaderMappings } from './loader-map';
import { ModelLoader } from './model-loader';
import { getFindUniqueForRef, getRefFromModel, getRelation } from './refs';
import {
  DelegateFromName,
  IncludeFromPrismaDelegate,
  ListRelationField,
  ModelName,
  PrismaConnectionFieldOptions,
  PrismaDelegate,
  RelatedConnectionOptions,
  RelatedFieldOptions,
  RelationShape,
  ShapeFromPrismaDelegate,
} from './types';
import { queryFromInfo } from './util';

const fieldBuilderProto = RootFieldBuilder.prototype as GiraphQLSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.prismaField = function prismaField({ type, resolve, ...options }) {
  const modelName: string = Array.isArray(type) ? type[0] : type;
  const typeRef = getRefFromModel(modelName, this.builder);
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
  Name extends ModelName<SchemaTypes>,
  Type extends DelegateFromName<SchemaTypes, Name>,
  Nullable extends boolean,
  ResolveReturnShape,
  Args extends InputFieldMap,
>(
  this: typeof fieldBuilderProto,
  {
    type,
    cursor,
    maxSize,
    defaultSize,
    resolve,
    ...options
  }: Omit<
    FieldOptionsFromKind<
      SchemaTypes,
      unknown,
      Type,
      Nullable,
      Args & InputFieldsFromShape<GiraphQLSchemaTypes.DefaultConnectionArguments>,
      FieldKind,
      unknown,
      ResolveReturnShape
    >,
    'args' | 'resolve' | 'type'
  > &
    PrismaConnectionFieldOptions<
      SchemaTypes,
      unknown,
      Name,
      DelegateFromName<SchemaTypes, Name>,
      ObjectRef<ShapeFromPrismaDelegate<Type>>,
      Nullable,
      Args,
      ResolveReturnShape,
      FieldKind
    >,
  connectionOptions: GiraphQLSchemaTypes.ConnectionObjectOptions<
    SchemaTypes,
    Type,
    ResolveReturnShape
  >,
  edgeOptions: GiraphQLSchemaTypes.ConnectionEdgeObjectOptions<
    SchemaTypes,
    Type,
    ResolveReturnShape
  >,
) {
  const ref = getRefFromModel(type, this.builder);

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
        giraphQLPrismaIndirectInclude: ['edges', 'node'],
      },
    },
    edgeOptions,
  );

  return fieldRef;
} as never;

export class PrismaObjectFieldBuilder<
  Types extends SchemaTypes,
  Type extends PrismaDelegate,
  NeedsResolve extends boolean,
> extends ObjectFieldBuilder<Types, ShapeFromPrismaDelegate<Type>> {
  model: string;

  relatedConnection: 'relay' extends PluginName
    ? <
        Field extends ListRelationField<Type>,
        Nullable extends boolean,
        Args extends InputFieldMap,
        ResolveReturnShape,
      >(
        ...args: NormalizeArgs<
          [
            field: Field,
            options: RelatedConnectionOptions<
              Types,
              ShapeFromPrismaDelegate<Type>,
              Type,
              Field,
              Nullable,
              Args,
              NeedsResolve
            >,
            connectionOptions?: GiraphQLSchemaTypes.ConnectionObjectOptions<
              Types,
              ObjectRef<ShapeFromPrismaDelegate<Type>>,
              ResolveReturnShape
            >,
            edgeOptions?: GiraphQLSchemaTypes.ConnectionEdgeObjectOptions<
              Types,
              ObjectRef<ShapeFromPrismaDelegate<Type>>,
              ResolveReturnShape
            >,
          ]
        >
      ) => FieldRef<
        GiraphQLSchemaTypes.ConnectionShapeHelper<
          Types,
          ShapeFromPrismaDelegate<Type>,
          Nullable
        >['shape']
      >
    : '@giraphql/plugin-relay is required to use this method' = function relatedConnection(
    this: PrismaObjectFieldBuilder<SchemaTypes, PrismaDelegate, boolean>,
    name: string,
    {
      maxSize,
      defaultSize,
      cursor,
      query,
      resolve,
      extensions,
      ...options
    }: {
      maxSize?: number;
      defaultSize?: number;
      cursor: string;
      extensions: {};
      query: ((args: {}) => {}) | {};
      resolve: (query: {}, parent: unknown, args: {}, ctx: {}, info: {}) => MaybePromise<{}[]>;
    },
    connectionOptions = {},
    edgeOptions = {},
  ) {
    const { client } = this.builder.options.prisma;
    const relationField = getRelation(client, this.model, name);
    const parentRef = getRefFromModel(this.model, this.builder);
    const ref = getRefFromModel(relationField.type, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const getQuery = (args: GiraphQLSchemaTypes.DefaultConnectionArguments) => ({
      ...((typeof query === 'function' ? query(args) : query) as {}),
      ...prismaCursorConnectionQuery({
        column: cursor,
        maxSize,
        defaultSize,
        args,
      }),
    });

    const fieldRef = (
      this as unknown as typeof fieldBuilderProto & {
        connection: (...args: unknown[]) => FieldRef<unknown>;
      }
    ).connection(
      {
        ...options,
        extensions: {
          ...extensions,
          giraphQLPrismaQuery: getQuery,
          giraphQLPrismaRelation: name,
        },
        type: ref,
        resolve: async (
          parent: object,
          args: GiraphQLSchemaTypes.DefaultConnectionArguments,
          context: {},
          info: GraphQLResolveInfo,
        ) => {
          const connectionQuery = getQuery(args);
          const getResult = () => {
            const mapping = getLoaderMapping(context, info.path);
            const loadedValue = (parent as Record<string, unknown>)[name];

            if (
              // if we attempted to load the relation, and its missing it will be null
              // undefined means that the query was not constructed in a way that requested the relation
              loadedValue !== undefined &&
              mapping
            ) {
              if (loadedValue !== null && loadedValue !== undefined) {
                setLoaderMappings(context, info.path, mapping);
              }

              return loadedValue as {}[];
            }

            if (!resolve && !findUnique) {
              throw new Error(`Missing findUnique for Prisma type ${this.model}`);
            }

            const mergedQuery = { ...queryFromInfo(context, info), ...connectionQuery };

            if (resolve) {
              return resolve(mergedQuery, parent, args, context, info);
            }

            return loaderCache(parent).loadRelation(name, mergedQuery, context) as Promise<{}[]>;
          };

          return wrapConnectionResult(await getResult(), args, connectionQuery.take, cursor);
        },
      },
      {
        ...connectionOptions,
        extensions: {
          ...(connectionOptions as Record<string, {}> | undefined)?.extensions,
          giraphQLPrismaIndirectInclude: ['edges', 'node'],
        },
      },
      edgeOptions,
    );

    return fieldRef;
  } as never;

  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, model: string) {
    super(name, builder);

    this.model = model;
  }

  relation<
    Field extends string & keyof IncludeFromPrismaDelegate<Type>,
    Nullable extends FieldNullability<Type>,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    ...allArgs: NormalizeArgs<
      [
        name: Field,
        options?: RelatedFieldOptions<
          Types,
          Type,
          Field,
          Nullable,
          Args,
          ResolveReturnShape,
          NeedsResolve
        >,
      ]
    >
  ): FieldRef<RelationShape<Type, Field>, 'Object'> {
    const [name, options = {} as never] = allArgs;
    const { client } = this.builder.options.prisma;
    const relationField = getRelation(client, this.model, name);
    const parentRef = getRefFromModel(this.model, this.builder);
    const ref = getRefFromModel(relationField.type, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const { query = {}, resolve, ...rest } = options;

    return this.field({
      ...rest,
      type: relationField.isList ? [ref] : ref,
      extensions: {
        ...options.extensions,
        giraphQLPrismaQuery: query,
        giraphQLPrismaRelation: name,
      },
      resolve: (parent, args, context, info) => {
        const mapping = getLoaderMapping(context, info.path);

        const loadedValue = (parent as Record<string, unknown>)[name];

        if (
          // if we attempted to load the relation, and its missing it will be null
          // undefined means that the query was not constructed in a way that requested the relation
          loadedValue !== undefined &&
          mapping
        ) {
          if (loadedValue !== null && loadedValue !== undefined) {
            setLoaderMappings(context, info.path, mapping);
          }

          return loadedValue as never;
        }

        const queryOptions = {
          ...((typeof query === 'function' ? query(args) : query) as {}),
          ...queryFromInfo(context, info),
        };

        if (resolve) {
          return resolve(queryOptions, parent, args as never, context, info);
        }

        if (!findUnique) {
          throw new Error(`Missing findUnique for Prisma type ${this.model}`);
        }

        return loaderCache(parent).loadRelation(name, queryOptions, context) as never;
      },
    }) as FieldRef<RelationShape<Type, Field>, 'Object'>;
  }
}
