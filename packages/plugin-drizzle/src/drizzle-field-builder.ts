import {
  type CompatibleTypes,
  type ExposeNullability,
  type FieldKind,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  type InputShapeFromFields,
  type InterfaceParam,
  isThenable,
  type MaybePromise,
  type NormalizeArgs,
  ObjectRef,
  type PluginName,
  PothosSchemaError,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import {
  and,
  type BuildQueryResult,
  type DBQueryConfig,
  eq,
  type InferSelectModel,
  Many,
  type SQL,
  type Table,
  type TableRelationalConfig,
} from 'drizzle-orm';
import {
  type FieldNode,
  Kind as GraphQLKind,
  type GraphQLResolveInfo,
  getNamedType,
  isInterfaceType,
  isObjectType,
} from 'graphql';
import type { DrizzleRef } from './interface-ref';
import type {
  DrizzleConnectionShape,
  ListRelation,
  RelatedConnectionOptions,
  RelatedCountOptions,
  RelatedFieldOptions,
  ShapeFromConnection,
  TypesForRelation,
  VariantFieldOptions,
} from './types';
import { getClient, getSchemaConfig } from './utils/config';
import {
  drizzleCursorConnectionQuery,
  getCursorFormatter,
  wrapConnectionResult,
} from './utils/cursors';
import { getRefFromModel } from './utils/refs';
import type { SelectionMap } from './utils/selections';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
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
  ExposableShape = InferSelectModel<Extract<TableConfig['table'], { _: { brand: 'Table' } }>>,
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
        const ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        const EdgeInterfaces extends InterfaceParam<Types>[] = [],
        Type = unknown,
        Shape = // biome-ignore lint/suspicious/noExplicitAny: generic match
        Type extends DrizzleRef<any, any>
          ? Type['$inferType']
          : TypesForRelation<Types, TableConfig['relations'][Field]>,
      >(
        field: Field,
        ...args: NormalizeArgs<
          [
            options: RelatedConnectionOptions<
              Types,
              Shape,
              TableConfig,
              Field,
              Nullable,
              Args,
              Type
            >,
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
                  DrizzleConnectionShape<
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
                  DrizzleConnectionShape<
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
    this: DrizzleObjectFieldBuilder<SchemaTypes, TableConfig, {}>,
    name: string,
    {
      maxSize = this.builder.options.drizzle?.maxConnectionSize,
      defaultSize = this.builder.options.drizzle?.defaultConnectionSize,
      query,
      resolve: _,
      extensions,
      description,
      totalCount,
      ...options
    }: {
      type?: ObjectRef<Types, unknown, unknown>;
      maxSize?: number | ((args: {}, ctx: {}) => number);
      defaultSize?: number | ((args: {}, ctx: {}) => number);
      extensions?: {};
      description?: string;
      query?: ((args: {}, ctx: {}) => {}) | {};
      totalCount?: boolean;
      resolve?: (
        query: {},
        parent: unknown,
        args: {},
        ctx: {},
        info: {},
      ) => MaybePromise<readonly {}[]>;
    } = {},
    connectionOptions = {},
    edgeOptions = {},
  ) {
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[name as string];
    const relatedTable = schemaConfig.relations[relationField.targetTableName];

    if (!relatedTable) {
      throw new PothosSchemaError(
        `Could not find relation ${name as string} on table ${this.table}`,
      );
    }

    const ref = options.type ?? getRefFromModel(relationField.targetTableName, this.builder);
    let typeName: string | undefined;

    const buildCountFilter = (parentTable: TableConfig['table']): SQL => {
      const { sourceColumns, targetColumns } = relationField;
      return and(
        ...sourceColumns.map((sourceCol: { name: string }, i: number) =>
          eq(targetColumns[i], parentTable[sourceCol.name as never]),
        ),
      )!;
    };

    const getQuery = (args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => {
      const { limit, orderBy, where, ...fieldQuery } =
        (typeof query === 'function' ? query(args, ctx) : query) ?? {};

      const { cursorColumns, columns, ...connectionQuery } = drizzleCursorConnectionQuery({
        ctx,
        maxSize,
        defaultSize,
        args,
        orderBy:
          (typeof orderBy === 'function' ? orderBy(relatedTable.table) : orderBy) ??
          getSchemaConfig(this.builder).getPrimaryKey(relationField.targetTableName),
        where,
        config: schemaConfig,
        table: relatedTable,
      });

      return {
        select: {
          ...fieldQuery,
          ...connectionQuery,
          columns: {
            ...fieldQuery.columns,
            ...columns,
          },
          limit: Math.abs(limit ?? connectionQuery.limit),
        },
        cursorColumns,
      };
    };

    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown, path?: unknown) => { select?: object },
      getSelection: (path: string[]) => FieldNode | null,
    ) => {
      typeName ??= this.builder.configStore.getTypeConfig(ref).name;

      const hasTotalCount = totalCount && !!getSelection(['totalCount']);
      const hasEdges = !!getSelection(['edges']);
      const hasNodes = !!getSelection(['nodes']);
      const hasPageInfo = !!getSelection(['pageInfo']);
      const totalCountOnly = hasTotalCount && !hasEdges && !hasNodes && !hasPageInfo;
      const countSelection = {
        [`_${name as string}_count`]: (parent: TableConfig['table']) =>
          getClient(this.builder, context).$count(
            relatedTable.table as Table,
            buildCountFilter(parent),
          ),
      };

      if (totalCountOnly) {
        return {
          columns: {},
          with: {},
          extras: countSelection,
        };
      }

      const nested = nestedQuery(getQuery(args, context).select, {
        getType: () => typeName!,
        paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
      }) as SelectionMap;

      return {
        columns: {},
        with: {
          [name]: nested,
        },
        extras: hasTotalCount ? countSelection : {},
      };
    };
    const fieldRef = (
      this as unknown as {
        connection: (...args: unknown[]) => FieldRef<Types, unknown>;
      }
    ).connection(
      {
        ...options,
        extensions: {
          ...extensions,
          pothosDrizzleSelect: relationSelect,
        },
        description,
        type: ref,
        resolve: (
          parent: unknown,
          args: PothosSchemaTypes.DefaultConnectionArguments,
          context: {},
          info: GraphQLResolveInfo,
        ) => {
          const countKey = `_${name as string}_count`;
          const parentRecord = parent as Record<string, unknown>;
          const countValue = totalCount
            ? (parentRecord[countKey] as number | undefined)
            : undefined;

          if (!(name in parentRecord)) {
            return {
              parent,
              args,
              totalCount: countValue,
              edges: [],
              pageInfo: {
                startCursor: null,
                endCursor: null,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            };
          }

          // Detect totalCountOnly to skip cursor computation when only totalCount is requested
          const returnType = getNamedType(info.returnType);
          const fields =
            isObjectType(returnType) || isInterfaceType(returnType) ? returnType.getFields() : {};
          const totalCountOnly = info.fieldNodes.every((selection) =>
            selection.selectionSet?.selections.every(
              (s) =>
                s.kind === GraphQLKind.FIELD &&
                (fields[s.name.value]?.extensions?.pothosDrizzleTotalCount ||
                  s.name.value === '__typename'),
            ),
          );

          if (totalCountOnly) {
            return {
              parent,
              args,
              totalCount: countValue,
              edges: [],
              pageInfo: {
                startCursor: null,
                endCursor: null,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            };
          }

          const { select, cursorColumns } = getQuery(args, context);

          return wrapConnectionResult(
            parentRecord[name] as readonly {}[],
            args,
            select.limit,
            getCursorFormatter(cursorColumns, schemaConfig),
            undefined,
            parent,
            countValue,
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
                      pothosDrizzleTotalCount: true,
                    },
                    resolve: (connection) => connection.totalCount,
                  }),
                  ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
                })
              : (connectionOptions as { fields: undefined }).fields,
          },
      edgeOptions,
    );
    return fieldRef;
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

  variant<
    Variant extends DrizzleRef<Types, TableConfig['name']> | TableConfig['name'],
    Args extends InputFieldMap,
    Nullable,
    ResolveShape,
    ResolveReturn,
  >(
    variant: Variant,
    ...allArgs: NormalizeArgs<
      [
        options: VariantFieldOptions<
          Types,
          TableConfig['name'] & keyof Types['DrizzleRelations'],
          Variant,
          Args,
          Nullable,
          Shape,
          ResolveShape,
          ResolveReturn
        >,
      ]
    >
  ): FieldRef<Types, ResolveReturn, 'Object'> {
    const [{ isNull, nullable, ...options } = {} as never] = allArgs;
    const ref: DrizzleRef<Types> =
      typeof variant === 'string' ? getRefFromModel(variant, this.builder) : variant;

    const selfSelect = (
      _args: object,
      _context: object,
      nestedQuery: (query: unknown) => unknown,
    ) => nestedQuery(options.select ?? {});

    return this.field({
      ...(options as {}),
      type: ref,
      extensions: {
        ...options?.extensions,
        pothosDrizzleSelect: selfSelect,
      },
      nullable: nullable ?? !!isNull,
      resolve: isNull
        ? (parent, args, context, info) => {
            const parentIsNull = isNull(parent as never, args as never, context, info);
            if (parentIsNull) {
              if (isThenable(parentIsNull)) {
                return parentIsNull.then((resolved) => (resolved ? null : parent)) as never;
              }
              return null as never;
            }
            return parent as never;
          }
        : (parent) => parent as never,
    }) as FieldRef<Types, ResolveReturn, 'Object'>;
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
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[name as string];
    const relatedTable = schemaConfig.relations[relationField.targetTableName];

    if (!relatedTable) {
      throw new PothosSchemaError(
        `Could not find relation ${name as string} on table ${this.table}`,
      );
    }
    const ref = options.type ?? getRefFromModel(relatedTable.name, this.builder);

    const { query = {}, extensions, ...rest } = options;

    const relationSelect = (args: object, context: object, nestedQuery: (query: unknown) => {}) => {
      const relQuery = {
        columns: {},
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

  relatedField<
    Field extends keyof TableConfig['relations'],
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Args extends InputFieldMap,
    Select extends DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
    ShapeWithSelection = Shape &
      BuildQueryResult<Types['DrizzleRelations'], TableConfig, Select & { columns: {} }>,
  >(
    relationName: Field,
    options: {
      type: Type;
      nullable?: Nullable;
      args?: Args;
      description?: string;
      select: (
        buildFilter: (parentTable: TableConfig['table']) => SQL,
        args: Args extends InputFieldMap ? InputShapeFromFields<Args> : {},
        ctx: Types['Context'],
        nestedQuery: (
          query: DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
        ) => DBQueryConfig<'many', Types['DrizzleRelations'], TableConfig>,
      ) => Select;
      resolve: (
        parent: ShapeWithSelection,
        args: Args extends InputFieldMap ? InputShapeFromFields<Args> : {},
        ctx: Types['Context'],
        info: unknown,
      ) => ShapeFromTypeParam<Types, Type, Nullable>;
    },
  ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> {
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[relationName as string];

    if (!relationField) {
      throw new PothosSchemaError(
        `Could not find relation ${relationName as string} on table ${this.table}`,
      );
    }

    const buildFilter = (parentTable: TableConfig['table']): SQL => {
      const { sourceColumns, targetColumns } = relationField;

      return and(
        ...sourceColumns.map((sourceCol, i) =>
          eq(targetColumns[i], parentTable[sourceCol.name as never]),
        ),
      )!;
    };

    const relationSelect = (
      args: object,
      context: Types['Context'],
      nestedQuery: (query: unknown) => unknown,
    ) => {
      const selection = options.select(
        buildFilter as never,
        args as never,
        context,
        nestedQuery as never,
      ) as Select & { with?: unknown };
      return {
        columns: selection.columns ?? {},
        extras: selection.extras,
        with: selection.with,
      };
    };

    return this.field({
      type: options.type,
      nullable: options.nullable,
      args: options.args,
      description: options.description,
      extensions: {
        pothosDrizzleSelect: relationSelect as never,
      },
      resolve: options.resolve as never,
    } as never) as never;
  }

  relatedCount<
    Field extends keyof TableConfig['relations'],
    Args extends InputFieldMap,
    Where extends SQL | undefined,
  >(
    relationName: Field,
    ...allArgs: NormalizeArgs<[options: RelatedCountOptions<Types, Shape, Args, Where>]>
  ): FieldRef<Types, number, 'DrizzleObject'> {
    const [{ where, ...options } = {} as never] = allArgs;
    const countKey = `_${relationName as string}_count`;
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[relationName as string];
    const relatedTable = schemaConfig.relations[relationField.targetTableName];

    return this.relatedField(relationName, {
      ...options,
      type: 'Int' as never,
      nullable: false,
      select: (
        buildFilter: (parent: TableConfig['table']) => SQL,
        args: object,
        ctx: Types['Context'],
      ) => {
        const whereClause =
          typeof where === 'function'
            ? (where as (args: unknown, ctx: unknown) => SQL | undefined)(args, ctx)
            : where;

        return {
          extras: {
            [countKey]: (parent: TableConfig['table']) =>
              getClient(this.builder, ctx).$count(
                relatedTable.table as Table,
                whereClause ? and(buildFilter(parent), whereClause) : buildFilter(parent),
              ),
          },
        } as never;
      },
      resolve: (parent: Record<string, number>) => parent[countKey],
    } as never) as FieldRef<Types, number, 'DrizzleObject'>;
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
            'nullable' | 'select' | InferredFieldOptionKeys
          >,
      ]
    >
  ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> {
    const [name, options = {} as never] = args;

    const typeConfig = this.builder.configStore.getTypeConfig(this.typename, this.graphqlKind);
    const usingSelect = !!typeConfig.extensions?.pothosDrizzleSelect;

    return this.exposeField<Type, Nullable, never>(name as never, {
      ...options,
      extensions: {
        ...options.extensions,
        pothosDrizzleVariant: name,
        pothosDrizzleSelect: usingSelect && {
          columns: { [name as string]: true },
        },
      },
    }) as FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'>;
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
              'nullable' | 'select' | 'type' | InferredFieldOptionKeys
            > & {
              description?: string | false;
            },
        ]
      >
    ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> => {
      const [name, options = {} as never] = args;

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
