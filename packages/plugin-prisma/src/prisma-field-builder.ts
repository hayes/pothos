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
import { PrismaObjectRef } from './object-ref';
import {
  PrismaModelTypes,
  RelatedConnectionOptions,
  RelatedFieldOptions,
  RelationCountOptions,
  ShapeFromConnection,
  VariantFieldOptions,
} from './types';
import { prismaCursorConnectionQuery, wrapConnectionResult } from './util/cursors';
import {
  getCursorFormatter,
  getCursorParser,
  getRefFromModel,
  getRelation,
} from './util/datamodel';
import { FieldMap } from './util/relation-map';

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
    const ref = options.type ?? getRefFromModel(relationField.type, this.builder);
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

    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown) => unknown,
    ) => ({
      select: {
        [name]: nestedQuery({
          ...((typeof query === 'function' ? query(args, context) : query) as {}),
          ...prismaCursorConnectionQuery({
            parseCursor,
            maxSize,
            defaultSize,
            args,
          }),
        }),
      },
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
          pothosPrismaSelect: relationSelect,
          pothosPrismaLoaded: (value: Record<string, unknown>) => value[name] !== undefined,
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
                    ...(typeof query === 'function' ? query(args, context) : query),
                  } as never,
                  parent,
                  args,
                  context,
                  info,
                ),
              ).then((result) => wrapConnectionResult(result, args, q.take, formatCursor))),
        },
        type: ref,
        resolve: (
          parent: unknown,
          args: PothosSchemaTypes.DefaultConnectionArguments,
          context: {},
        ) => {
          const connectionQuery = getQuery(args, context);

          return wrapConnectionResult(
            (parent as Record<string, never>)[name],
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
                  pothosPrismaParentSelect: { _count: { select: { [name]: true } } },
                },
                resolve: (parent, args, context) => parent.totalCount,
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

  constructor(
    name: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    model: string,
    fieldMap: FieldMap,
  ) {
    super(name, builder, 'PrismaObject', 'Object');

    this.model = model;
    this.prismaFieldMap = fieldMap;
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
    const ref = options.type ?? getRefFromModel(relationField.type, this.builder);

    const { query = {}, resolve, extensions, ...rest } = options;

    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown) => unknown,
    ) => ({ select: { [name]: nestedQuery(query) } });

    return this.field({
      ...rest,
      type: relationField.isList ? [ref] : ref,
      extensions: {
        ...extensions,
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
      resolve: (parent) => (parent as Record<string, never>)[name],
    }) as FieldRef<Model['Relations'][Field]['Shape'], 'Object'>;
  }

  relationCount<Field extends Model['Fields']>(
    ...allArgs: NormalizeArgs<
      [name: Field, options?: RelationCountOptions<Types, Shape, NeedsResolve>]
    >
  ): FieldRef<number, 'Object'> {
    const [name, options = {} as never] = allArgs;

    const { resolve, ...rest } = options;

    const countSelect = {
      _count: {
        select: { [name]: true },
      },
    };

    return this.field({
      ...rest,
      type: 'Int',
      nullable: false,
      select: countSelect as never,
      resolve: (parent, args, context, info) =>
        (parent as unknown as { _count: Record<string, never> })._count?.[name],
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

    const selfSelect = (args: object, context: object, nestedQuery: (query: unknown) => unknown) =>
      nestedQuery({});

    return this.field({
      ...options,
      type: ref,
      select: selfSelect as never,
      resolve: (parent, args, context, info) => parent,
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
          'resolve' | 'select'
        >,
      ]
    >
  ) {
    const [name, options = {} as never] = args;

    const typeConfig = this.builder.configStore.getTypeConfig(this.typename, 'Object');
    const usingSelect = !!typeConfig.extensions?.pothosPrismaSelect;

    return this.exposeField(name as never, {
      ...options,
      extensions: {
        ...options.extensions,
        pothosPrismaVariant: name,
        pothosPrismaSelect: usingSelect && {
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
            'resolve' | 'type' | 'select'
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
