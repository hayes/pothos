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
  type TableRelationalConfig,
} from 'drizzle-orm';
import type { DrizzleRef } from './interface-ref';
import type {
  DrizzleConnectionShape,
  ListRelation,
  RelatedConnectionOptions,
  RelatedFieldOptions,
  ShapeFromConnection,
  TypesForRelation,
  VariantFieldOptions,
} from './types';
import { getSchemaConfig } from './utils/config';
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
      ...options
    }: {
      type?: ObjectRef<Types, unknown, unknown>;
      maxSize?: number | ((args: {}, ctx: {}) => number);
      defaultSize?: number | ((args: {}, ctx: {}) => number);
      extensions?: {};
      description?: string;
      query?: ((args: {}, ctx: {}) => {}) | {};
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
    ) => {
      typeName ??= this.builder.configStore.getTypeConfig(ref).name;
      const nested = nestedQuery(getQuery(args, context).select, {
        getType: () => typeName!,
        paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
      }) as SelectionMap;

      return {
        columns: {},
        with: {
          [name]: nested,
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
        ) => {
          const { select, cursorColumns } = getQuery(args, context);
          return wrapConnectionResult(
            (parent as Record<string, never>)[name],
            args,
            select.limit,
            getCursorFormatter(cursorColumns, schemaConfig),
            undefined,
            parent,
          );
        },
      },
      connectionOptions instanceof ObjectRef
        ? connectionOptions
        : {
            ...connectionOptions,
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

  /**
   * Create a field that uses a relation's join condition to add computed values (like counts)
   * to the parent selection via extras.
   *
   * This is useful for aggregations like counting related items without fetching them:
   * ```ts
   * postsCount: t.relatedField('posts', {
   *   type: 'Int',
   *   select: (buildFilter) => ({
   *     extras: {
   *       postsCount: (parent) => db.$count(posts, buildFilter(parent)),
   *     },
   *   }),
   *   resolve: (user) => user.postsCount,
   * })
   * ```
   *
   * The `buildFilter` function takes the parent table reference (from Drizzle's extras callback)
   * and returns the SQL condition for the relation join (e.g., `eq(posts.authorId, parent.id)`).
   */
  relatedField<
    Field extends keyof TableConfig['relations'],
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Args extends InputFieldMap,
    Select extends DBQueryConfig<'one', Types['DrizzleRelations'], TableConfig>,
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

    // Create a function that builds the join condition given a parent table reference
    const buildFilter = (parentTable: TableConfig['table']): SQL => {
      const { sourceColumns, targetColumns } = relationField;

      if (sourceColumns.length !== targetColumns.length) {
        throw new PothosSchemaError(
          `Relation ${relationName as string} has mismatched source/target columns`,
        );
      }

      // Map source column names to the aliased parent table columns
      const parentColumns = sourceColumns.map((sourceCol) => {
        const colName = sourceCol.name;
        return (parentTable as unknown as Record<string, unknown>)[colName];
      });

      if (sourceColumns.length === 1) {
        return eq(targetColumns[0], parentColumns[0] as never);
      }

      // For composite keys, AND all the conditions together
      const conditions = sourceColumns.map((_, i) =>
        eq(targetColumns[i], parentColumns[i] as never),
      );
      return and(...conditions)!;
    };

    const relationSelect = (
      args: object,
      context: Types['Context'],
      _nestedQuery: (query: unknown) => {},
    ) => {
      const selection = options.select(buildFilter as never, args as never, context);
      return {
        columns: selection.columns ?? {},
        extras: selection.extras,
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
