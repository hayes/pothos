import { InferModelFromColumns, Many, TableRelationalConfig } from 'drizzle-orm';
import {
  CompatibleTypes,
  ExposeNullability,
  FieldKind,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  MaybePromise,
  NormalizeArgs,
  ObjectRef,
  PluginName,
  PothosSchemaError,
  RootFieldBuilder,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import {
  DrizzleConnectionShape,
  ListRelation,
  RelatedConnectionOptions,
  RelatedFieldOptions,
  ShapeFromConnection,
  TypesForRelation,
} from './types';
import { getRefFromModel } from './utils/refs';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

export class DrizzleObjectFieldBuilder<
  Types extends SchemaTypes,
  TableConfig extends TableRelationalConfig,
  Shape,
  ExposableShape = InferModelFromColumns<TableConfig['columns']>,
> extends RootBuilder<Types, Shape, 'DrizzleObject'> {
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

  table: string;

  typename: string;

  relatedConnection: 'relay' extends PluginName
    ? <
        Field extends ListRelation<TableConfig>,
        Nullable extends boolean,
        Args extends InputFieldMap,
        ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        EdgeInterfaces extends InterfaceParam<Types>[] = [],
      >(
        field: Field,
        options: RelatedConnectionOptions<Types, Shape, TableConfig, Field, Nullable, Args>,
        ...args: NormalizeArgs<
          [
            connectionOptions:
              | ObjectRef<
                  Types,
                  ShapeFromConnection<
                    PothosSchemaTypes.ConnectionShapeHelper<
                      Types,
                      TypesForRelation<Types, TableConfig['relations'][Field]>,
                      false
                    >
                  >
                >
              | PothosSchemaTypes.ConnectionObjectOptions<
                  Types,
                  ObjectRef<
                    Types,
                    ShapeFromTypeParam<
                      Types,
                      [ObjectRef<Types, TypesForRelation<Types, TableConfig['relations'][Field]>>],
                      Nullable
                    >
                  >,
                  false,
                  false,
                  DrizzleConnectionShape<
                    Types,
                    ShapeFromTypeParam<
                      Types,
                      [ObjectRef<Types, TypesForRelation<Types, TableConfig['relations'][Field]>>],
                      Nullable
                    >,
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
                    node?: TypesForRelation<Types, TableConfig['relations'][Field]>;
                  }
                >
              | PothosSchemaTypes.ConnectionEdgeObjectOptions<
                  Types,
                  ObjectRef<
                    Types,
                    ShapeFromTypeParam<
                      Types,
                      [ObjectRef<Types, TypesForRelation<Types, TableConfig['relations'][Field]>>],
                      Nullable
                    >
                  >,
                  false,
                  DrizzleConnectionShape<
                    Types,
                    ShapeFromTypeParam<
                      Types,
                      [ObjectRef<Types, TypesForRelation<Types, TableConfig['relations'][Field]>>],
                      Nullable
                    >,
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
    this: DrizzleObjectFieldBuilder<SchemaTypes, TableConfig, boolean>,
    name: string,
    {
      maxSize,
      defaultSize,
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
    // const relationField = getRelation(this.model, this.builder, name);
    // const ref = options.type ?? getRefFromModel(relationField.type, this.builder);
    // let typeName: string | undefined;
    // const formatCursor = getCursorFormatter(relationField.type, this.builder, cursorValue);
    // const parseCursor = getCursorParser(relationField.type, this.builder, cursorValue);
    // const getQuery = (args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => {
    //   const connectionQuery = prismaCursorConnectionQuery({
    //     parseCursor,
    //     ctx,
    //     maxSize,
    //     defaultSize,
    //     args,
    //   });
    //   const {
    //     take = connectionQuery.take,
    //     skip = connectionQuery.skip,
    //     cursor = connectionQuery.cursor,
    //     ...fieldQuery
    //   } = ((typeof query === 'function' ? query(args, ctx) : query) ??
    //     {}) as typeof connectionQuery;
    //   return {
    //     ...fieldQuery,
    //     ...connectionQuery,
    //     take,
    //     skip,
    //     ...(cursor ? { cursor } : {}),
    //   };
    // };
    // const cursorSelection = ModelLoader.getCursorSelection(
    //   ref as never,
    //   relationField.type,
    //   cursorValue,
    //   this.builder,
    // );
    // const relationSelect = (
    //   args: object,
    //   context: object,
    //   nestedQuery: (query: unknown, path?: unknown) => { select?: {} },
    //   getSelection: (path: string[]) => FieldNode | null,
    // ) => {
    //   const nested = nestedQuery(getQuery(args, context), {
    //     getType: () => {
    //       if (!typeName) {
    //         typeName = this.builder.configStore.getTypeConfig(ref).name;
    //       }
    //       return typeName;
    //     },
    //     paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
    //   }) as SelectionMap;
    //   const hasTotalCount = totalCount && !!getSelection(['totalCount']);
    //   const countSelect = this.builder.options.prisma.filterConnectionTotalCount
    //     ? nested.where
    //       ? { where: nested.where }
    //       : true
    //     : true;
    //   return {
    //     select: {
    //       ...(hasTotalCount ? { _count: { select: { [name]: countSelect } } } : {}),
    //       [name]: nested?.select
    //         ? {
    //             ...nested,
    //             select: {
    //               ...cursorSelection,
    //               ...nested.select,
    //             },
    //           }
    //         : nested,
    //     },
    //   };
    // };
    // const fieldRef = (
    //   this as unknown as {
    //     connection: (...args: unknown[]) => FieldRef<Types, unknown>;
    //   }
    // ).connection(
    //   {
    //     ...options,
    //     description: getFieldDescription(this.model, this.builder, name, description),
    //     extensions: {
    //       ...extensions,
    //       pothosPrismaSelect: relationSelect,
    //       pothosPrismaLoaded: (value: Record<string, unknown>) => value[name] !== undefined,
    //       pothosPrismaFallback:
    //         resolve &&
    //         ((
    //           q: { take: number },
    //           parent: unknown,
    //           args: PothosSchemaTypes.DefaultConnectionArguments,
    //           context: {},
    //           info: GraphQLResolveInfo,
    //         ) =>
    //           Promise.resolve(
    //             resolve(
    //               {
    //                 ...q,
    //                 ...getQuery(args, context),
    //               } as never,
    //               parent,
    //               args,
    //               context,
    //               info,
    //             ),
    //           ).then((result) => wrapConnectionResult(parent, result, args, q.take, formatCursor))),
    //     },
    //     type: ref,
    //     resolve: (
    //       parent: unknown,
    //       args: PothosSchemaTypes.DefaultConnectionArguments,
    //       context: {},
    //     ) => {
    //       const connectionQuery = getQuery(args, context);
    //       return wrapConnectionResult(
    //         parent,
    //         (parent as Record<string, never>)[name],
    //         args,
    //         connectionQuery.take,
    //         formatCursor,
    //         (parent as { _count?: Record<string, number> })._count?.[name],
    //       );
    //     },
    //   },
    //   connectionOptions instanceof ObjectRef
    //     ? connectionOptions
    //     : {
    //         ...connectionOptions,
    //         fields: totalCount
    //           ? (
    //               t: PothosSchemaTypes.ObjectFieldBuilder<SchemaTypes, { totalCount?: number }>,
    //             ) => ({
    //               totalCount: t.int({
    //                 nullable: false,
    //                 resolve: (parent, args, context) => parent.totalCount,
    //               }),
    //               ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
    //             })
    //           : (connectionOptions as { fields: undefined }).fields,
    //       },
    //   edgeOptions,
    // );
    // return fieldRef;
  } as never;

  constructor(
    typename: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    table: string,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind] = 'Object',
  ) {
    super(builder, 'DrizzleObject', graphqlKind);

    this.table = table;
    this.typename = typename;
  }

  relation<
    Field extends keyof TableConfig['relations'],
    Nullable extends boolean,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    name: Field,
    ...allArgs: NormalizeArgs<
      [
        options: RelatedFieldOptions<
          Types,
          TableConfig,
          Field,
          Nullable,
          Args,
          ResolveReturnShape,
          Shape
        >,
      ]
    >
  ): FieldRef<Types, TypesForRelation<Types, TableConfig['relations'][Field]>, 'Object'> {
    const [options = {} as never] = allArgs;
    const relationField =
      this.builder.options.drizzle.client._.schema?.[this.table].relations[name as string];

    if (!relationField) {
      throw new PothosSchemaError(
        `Could not find relation ${name as string} on table ${this.table}`,
      );
    }

    const ref = options.type ?? getRefFromModel(relationField.referencedTableName, this.builder);

    const { query = {}, extensions, ...rest } = options;

    const relationSelect = (args: object, context: object, nestedQuery: (query: unknown) => {}) => {
      const relQuery = {
        with: {
          [name]: {
            ...nestedQuery(query),
            ...((typeof query === 'function'
              ? (query as (args: {}, context: {}) => {})(args, context)
              : query) as {}),
          },
        },
      };

      return relQuery;
    };

    return this.field({
      ...(rest as {}),
      type: relationField instanceof Many ? [ref] : ref,
      extensions: {
        ...extensions,
        pothosDrizzleSelect: relationSelect as never,
      },
      resolve: (parent: Record<string, never>) => parent[name as string],
    } as never) as never;
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends CompatibleTypes<Types, ExposableShape, Type, Nullable>,
  >(
    ...args: NormalizeArgs<
      [
        name: Name,
        options: ExposeNullability<Types, Type, ExposableShape, Name, Nullable> &
          Omit<
            PothosSchemaTypes.ObjectFieldOptions<
              Types,
              Shape,
              Type,
              Nullable,
              {},
              ResolveReturnShape
            >,
            'nullable' | 'resolve' | 'select'
          >,
      ]
    >
  ) {
    const [name, options = {} as never] = args;

    const typeConfig = this.builder.configStore.getTypeConfig(this.typename, 'Object');
    const usingSelect = !!typeConfig.extensions?.pothosDrizzleSelect;

    return this.exposeField(name as never, {
      ...options,
      extensions: {
        ...options.extensions,
        pothosDrizzleVariant: name,
        pothosDrizzleSelect: usingSelect && {
          columns: { [name as string]: true },
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
        ExposableShape,
        Type,
        Type extends [unknown] ? { list: true; items: true } : true
      >,
    >(
      ...args: NormalizeArgs<
        [
          name: Name,
          options: ExposeNullability<Types, Type, ExposableShape, Name, Nullable> &
            Omit<
              PothosSchemaTypes.ObjectFieldOptions<
                Types,
                ExposableShape,
                Type,
                Nullable,
                {},
                ResolveReturnShape
              >,
              'nullable' | 'resolve' | 'select' | 'type'
            > & {
              description?: string | false;
            },
        ]
      >
    ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> => {
      const [name, { description, ...options } = {} as never] = args;

      return this.expose(
        name as never,
        {
          ...options,
          type,
        } as never,
      ) as never;
    };
  }
}
