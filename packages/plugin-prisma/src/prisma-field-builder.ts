/* eslint-disable no-underscore-dangle */
import { GraphQLResolveInfo } from 'graphql';
import {
  CompatibleTypes,
  FieldKind,
  FieldRef,
  InputFieldMap,
  MaybePromise,
  NormalizeArgs,
  ObjectRef,
  PluginName,
  RootFieldBuilder,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import { prismaCursorConnectionQuery, wrapConnectionResult } from './cursors';
import { getLoaderMapping, setLoaderMappings } from './loader-map';
import { ModelLoader } from './model-loader';
import { PrismaObjectRef } from './object-ref';
import {
  getCursorFormatter,
  getCursorParser,
  getDelegateFromModel,
  getFindUniqueForRef,
  getRefFromModel,
  getRelation,
} from './refs';
import {
  PrismaDelegate,
  PrismaModelTypes,
  RelatedConnectionOptions,
  RelatedFieldOptions,
  RelationCountOptions,
  ShapeFromConnection,
} from './types';
import { queryFromInfo, SELF_RELATION } from './util';
import { VariantFieldOptions } from '.';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    name: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

export class PrismaObjectFieldBuilder<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  NeedsResolve extends boolean,
  Shape extends object = Model['Shape'],
> extends RootBuilder<Types, Shape, 'PrismaObject'> {
  delegate: PrismaDelegate;
  model: string;

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

  relatedConnection: 'relay' extends PluginName
    ? <
        Field extends Model['ListRelations'],
        Nullable extends boolean,
        Args extends InputFieldMap,
        ResolveReturnShape,
      >(
        ...args: NormalizeArgs<
          [
            field: Field,
            options: RelatedConnectionOptions<Types, Model, Field, Nullable, Args, NeedsResolve>,
            connectionOptions?: PothosSchemaTypes.ConnectionObjectOptions<
              Types,
              ObjectRef<Shape>,
              false,
              false,
              ResolveReturnShape
            >,
            edgeOptions?: PothosSchemaTypes.ConnectionEdgeObjectOptions<
              Types,
              ObjectRef<Shape>,
              false,
              ResolveReturnShape
            >,
          ]
        >
      ) => FieldRef<
        ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, Shape, Nullable>>
      >
    : '@pothos/plugin-relay is required to use this method' = function relatedConnection(
    this: PrismaObjectFieldBuilder<SchemaTypes, Model, boolean>,
    name: string,
    {
      maxSize,
      defaultSize,
      cursor,
      query,
      resolve,
      extensions,
      totalCount,
      ...options
    }: {
      type?: ObjectRef<unknown, unknown>;
      totalCount?: boolean;
      maxSize?: number;
      defaultSize?: number;
      cursor: string;
      extensions: {};
      query: ((args: {}, ctx: {}) => {}) | {};
      resolve: (query: {}, parent: unknown, args: {}, ctx: {}, info: {}) => MaybePromise<{}[]>;
    },
    connectionOptions = {},
    edgeOptions = {},
  ) {
    const relationField = getRelation(this.model, this.builder, name);
    const parentRef = getRefFromModel(this.model, this.builder);
    const ref = options.type ?? getRefFromModel(relationField.type, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);
    let typeName: string | undefined;

    const formatCursor = getCursorFormatter(relationField.type, this.builder, cursor);
    const parseCursor = getCursorParser(relationField.type, this.builder, cursor);

    const getQuery = (args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => ({
      ...((typeof query === 'function' ? query(args, ctx) : query) as {}),
      ...prismaCursorConnectionQuery({
        parseCursor,
        maxSize,
        defaultSize,
        args,
      }),
    });

    const fieldRef = (
      this as unknown as {
        connection: (...args: unknown[]) => FieldRef<unknown>;
      }
    ).connection(
      {
        ...options,
        extensions: {
          ...extensions,
          pothosPrismaQuery: getQuery,
          pothosPrismaRelation: name,
        },
        type: ref,
        resolve: async (
          parent: object,
          args: PothosSchemaTypes.DefaultConnectionArguments,
          context: {},
          info: GraphQLResolveInfo,
        ) => {
          const connectionQuery = getQuery(args, context);
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

          return wrapConnectionResult(
            await getResult(),
            args,
            connectionQuery.take,
            formatCursor,
            (parent as { _count?: Record<string, number> })._count?.[name],
          );
        },
      },
      {
        ...connectionOptions,
        fields: totalCount
          ? (t: PothosSchemaTypes.ObjectFieldBuilder<SchemaTypes, { totalCount?: number }>) => ({
              totalCount: t.int({
                extensions: {
                  pothosPrismaRelationCountForParent: name,
                },
                resolve: (parent, args, context) => {
                  const loadedValue = parent.totalCount;

                  if (loadedValue !== undefined) {
                    return loadedValue;
                  }

                  return loaderCache(parent).loadCount(name, context);
                },
              }),
              ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
            })
          : (connectionOptions as { fields: undefined }).fields,
        extensions: {
          ...(connectionOptions as Record<string, {}> | undefined)?.extensions,
          pothosPrismaIndirectInclude: {
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

  constructor(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, model: string) {
    super(name, builder, 'PrismaObject', 'Object');

    this.model = model;
    this.delegate = getDelegateFromModel(builder.options.prisma.client, model);
  }

  relation<
    Field extends Model['Fields'],
    Nullable extends boolean,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    ...allArgs: NormalizeArgs<
      [
        name: Field,
        options?: RelatedFieldOptions<
          Types,
          Model,
          Field,
          Nullable,
          Args,
          ResolveReturnShape,
          NeedsResolve,
          Shape
        >,
      ]
    >
  ): FieldRef<Model['Relations'][Field]['Shape'], 'Object'> {
    const [name, options = {} as never] = allArgs;
    const relationField = getRelation(this.model, this.builder, name);
    const parentRef = getRefFromModel(this.model, this.builder);
    const ref = options.type ?? getRefFromModel(relationField.type, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const { query = {}, resolve, ...rest } = options;

    return this.field({
      ...rest,
      type: relationField.isList ? [ref] : ref,
      extensions: {
        ...options.extensions,
        pothosPrismaQuery: query,
        pothosPrismaRelation: name,
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
          ...((typeof query === 'function' ? query(args, context) : query) as {}),
          ...queryFromInfo(context, info),
        };

        if (resolve) {
          return resolve(
            queryOptions as never,
            parent as never,
            args as never,
            context,
            info,
          ) as never;
        }

        if (!findUnique) {
          throw new Error(`Missing findUnique for Prisma type ${this.model}`);
        }

        return loaderCache(parent).loadRelation(name, queryOptions, context) as never;
      },
    }) as FieldRef<Model['Relations'][Field]['Shape'], 'Object'>;
  }

  relationCount<Field extends Model['Fields']>(
    ...allArgs: NormalizeArgs<
      [name: Field, options?: RelationCountOptions<Types, Shape, NeedsResolve>]
    >
  ): FieldRef<number, 'Object'> {
    const [name, options = {} as never] = allArgs;
    const parentRef = getRefFromModel(this.model, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const { resolve, ...rest } = options;

    return this.field({
      ...rest,
      type: 'Int',
      nullable: false,
      extensions: {
        ...options.extensions,
        pothosPrismaRelationCount: name,
      },
      resolve: (parent, args, context, info) => {
        const loadedValue = (parent as unknown as { _count: Record<string, unknown> })._count?.[
          name
        ];

        if (loadedValue !== undefined) {
          return loadedValue as never;
        }

        if (resolve) {
          return resolve(parent, args, context, info) as never;
        }

        if (!findUnique) {
          throw new Error(`Missing findUnique for Prisma type ${this.model}`);
        }

        return loaderCache(parent).loadCount(name, context) as never;
      },
    }) as FieldRef<number, 'Object'>;
  }

  variant<Variant extends Model['Name'] | PrismaObjectRef<Model>>(
    ...allArgs: NormalizeArgs<
      [
        variant: Variant,
        options?: VariantFieldOptions<
          Types,
          Model,
          Variant extends PrismaObjectRef<Model> ? Variant : PrismaObjectRef<Model>
        >,
      ]
    >
  ): FieldRef<Model['Shape'], 'Object'> {
    const [variant, options = {} as never] = allArgs;
    const ref: PrismaObjectRef<PrismaModelTypes> =
      typeof variant === 'string' ? getRefFromModel(variant, this.builder) : variant;
    const parentRef = getRefFromModel(this.model, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    return this.field({
      ...options,
      type: ref,
      extensions: {
        ...options.extensions,
        pothosPrismaRelation: SELF_RELATION,
      },
      resolve: (parent, args, context, info) => {
        const mapping = getLoaderMapping(context, info.path);

        if (mapping) {
          setLoaderMappings(context, info.path, mapping);

          return parent as never;
        }

        const queryOptions = queryFromInfo(context, info);

        if (!findUnique) {
          throw new Error(`Missing findUnique for Prisma type ${this.model}`);
        }

        return loaderCache(parent).loadSelf(queryOptions, context) as never;
      },
    }) as FieldRef<Model['Shape'], 'Object'>;
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends CompatibleTypes<Types, Model['Shape'], Type, Nullable>,
  >(
    ...args: NormalizeArgs<
      [
        name: Name,
        options?: Omit<
          PothosSchemaTypes.ObjectFieldOptions<
            Types,
            Shape,
            Type,
            Nullable,
            {},
            ResolveReturnShape
          >,
          'resolve'
        >,
      ]
    >
  ) {
    const [name, options = {} as never] = args;

    return this.exposeField(name as never, {
      ...options,
      extensions: {
        ...options.extensions,
        pothosPrismaSelect: {
          [name]: true,
        },
      },
    });
  }

  private createExpose<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      ResolveReturnShape,
      Name extends CompatibleTypes<Types, Model['Shape'], Type, Nullable>,
    >(
      ...args: NormalizeArgs<
        [
          name: Name,
          options?: Omit<
            PothosSchemaTypes.ObjectFieldOptions<
              Types,
              Shape,
              Type,
              Nullable,
              {},
              ResolveReturnShape
            >,
            'resolve' | 'type'
          >,
        ]
      >
    ) => {
      const [name, options = {} as never] = args;

      return this.expose(name as never, {
        ...options,
        type,
      });
    };
  }
}
