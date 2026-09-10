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
  PothosSchemaError,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import { getLoaderMapping, type Position, selectedFieldNames } from '@pothos/selection-mapper';
import {
  and,
  type BuildQueryResult,
  type DBQueryConfig,
  type InferSelectModel,
  Many,
  type Relation,
  relationsFilterToSQL,
  type SQL,
  type Table,
  type TableRelationalConfig,
  type TablesRelationalConfig,
} from 'drizzle-orm';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import type { DrizzleRef } from './interface-ref.js';
import type {
  DrizzleConnectionShape,
  ListRelation,
  PathInfo,
  RelatedConnectionOptions,
  RelatedCountOptions,
  RelatedFieldOptions,
  RelatedSelectionFieldOptions,
  ShapeFromConnection,
  TypesForRelation,
  VariantFieldOptions,
} from './types.js';
import { getClient, getSchemaConfig } from './utils/config.js';
import {
  type DrizzleCursorConnectionQueryOptions,
  drizzleCursorConnectionQuery,
  getCursorFormatter,
  wrapConnectionResult,
} from './utils/cursors.js';
import { pathInfoFor } from './utils/path-info.js';
import { getRefFromModel } from './utils/refs.js';
import { buildRelationFilter, type RelationQueryBuilder } from './utils/relation-filter.js';
import type { SelectionMap } from './utils/selections.js';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

// drizzle-orm declares two parameters, but the implementation also takes the table's relations
// and the full relational config, which lets a `where` filter on related tables.
type RelationsFilterToSQL = (
  table: Table,
  filter: unknown,
  tableRelations?: TableRelationalConfig['relations'],
  tablesRelations?: TablesRelationalConfig,
) => SQL | undefined;

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

    const filterTotalCount = this.builder.options.drizzle?.filterConnectionTotalCount !== false;

    // The count for `totalCount` matches the connection's own filter: what the relation selects
    // (including a `through` join and the relation's own `where`) plus the `where` from the
    // field's `query`, so the count agrees with the rows being paginated. The `where` goes
    // through the same `relationsFilterToSQL` the relational query builder puts it through, and
    // `countRows` combines the two in the same order, so the count's predicate is the page
    // query's predicate less the limit and the keyset clauses.
    const buildCount = (
      client: RelationQueryBuilder,
      parentTable: TableConfig['table'],
      where?: unknown,
    ): SQL<number> => {
      const { countRows } = buildRelationFilter(
        client,
        relationField as Relation,
        parentTable as Table,
      );

      if (!where || !filterTotalCount) {
        return countRows();
      }

      return countRows(
        (relationsFilterToSQL as RelationsFilterToSQL)(
          relatedTable.table as Table,
          where,
          relatedTable.relations,
          schemaConfig.relations,
        ),
      );
    };

    interface ConnectionFieldQuery {
      limit?: number;
      orderBy?: unknown;
      where?: SQL;
      columns?: Record<string, boolean>;
      extras?: DrizzleCursorConnectionQueryOptions['extras'];
    }

    // The field's `query` may be async, so the result is a promise when it is (A-5). The
    // `PathInfo` is built from the position here, and only for a callback that takes one.
    const resolveFieldQuery = (
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: {},
      position?: Position,
    ): MaybePromise<ConnectionFieldQuery> =>
      completeValue(
        (typeof query === 'function'
          ? (
              query as (
                args: {},
                ctx: {},
                pathInfo?: PathInfo,
              ) => MaybePromise<{} | null | undefined>
            )(args, ctx, pathInfoFor(position))
          : query) as MaybePromise<ConnectionFieldQuery | null | undefined>,
        orEmpty,
      );

    const getQuery = (
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: {},
      { limit, orderBy, where, ...fieldQuery }: ConnectionFieldQuery,
    ) => {
      const { cursorFields, columns, ...connectionQuery } = drizzleCursorConnectionQuery({
        ctx,
        maxSize,
        defaultSize,
        args,
        orderBy:
          (typeof orderBy === 'function' ? orderBy(relatedTable.table) : orderBy) ??
          getSchemaConfig(this.builder).getPrimaryKey(relationField.targetTableName),
        extras: fieldQuery.extras,
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
        cursorFields,
      };
    };

    const countKey = `_${name as string}_count`;

    // What the document asks of this connection, read the way the planner reads it (through
    // fragments, directives, and a wrapping type), so the resolve side agrees with the plan. The
    // selection is read once per request and shared by every parent row.
    const connectionSelection = (context: object, info: GraphQLResolveInfo) => {
      const selected = selectedFieldNames(context, info);
      const hasTotalCount = !!totalCount && selected.has('totalCount');
      const hasRows = selected.has('edges') || selected.has('nodes') || selected.has('pageInfo');

      return { hasTotalCount, totalCountOnly: hasTotalCount && !hasRows };
    };

    // Built once per field, so a synchronous plan allocates nothing beyond the map itself.
    const selectConnection = (
      fieldQuery: ConnectionFieldQuery,
      nested: SelectionMap | undefined,
      context: object,
      hasTotalCount: boolean,
      totalCountOnly: boolean,
    ) => {
      const countSelection = {
        [countKey]: (parent: TableConfig['table']) =>
          buildCount(getClient(this.builder, context) as never, parent, fieldQuery.where),
      };

      if (totalCountOnly) {
        return {
          columns: {},
          with: {},
          extras: countSelection,
        };
      }

      return {
        columns: {},
        with: {
          [name]: nested,
        },
        extras: hasTotalCount ? countSelection : {},
      };
    };

    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown, path?: unknown) => { select?: object },
      getSelection: (path: string[]) => FieldNode | null,
      position: Position,
    ) => {
      typeName ??= this.builder.configStore.getTypeConfig(ref).name;

      const hasTotalCount = !!totalCount && !!getSelection(['totalCount']);
      const hasEdges = !!getSelection(['edges']);
      const hasNodes = !!getSelection(['nodes']);
      const hasPageInfo = !!getSelection(['pageInfo']);
      const totalCountOnly = hasTotalCount && !hasEdges && !hasNodes && !hasPageInfo;
      const fieldQuery = resolveFieldQuery(args, context, position);
      // The nested plan starts now, with a query that waits for the field's `query` when that is
      // async, so every callback beneath the connection runs in the same tick (A-3).
      const nested = totalCountOnly
        ? undefined
        : (nestedQuery(
            isThenable(fieldQuery)
              ? fieldQuery.then((resolved) => getQuery(args, context, resolved).select)
              : getQuery(args, context, fieldQuery).select,
            {
              getType: () => typeName!,
              paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
            },
          ) as MaybePromise<SelectionMap>);

      return isThenable(fieldQuery) || isThenable(nested)
        ? Promise.all([fieldQuery, nested]).then(([resolvedQuery, resolvedNested]) =>
            selectConnection(resolvedQuery, resolvedNested, context, hasTotalCount, totalCountOnly),
          )
        : selectConnection(fieldQuery, nested, context, hasTotalCount, totalCountOnly);
    };

    // The loaded path, per parent row: the rows are on the parent, only the page is needed.
    const resolveLoaded = (
      fieldQuery: ConnectionFieldQuery,
      parent: unknown,
      args: PothosSchemaTypes.DefaultConnectionArguments,
      context: {},
      countValue: number | undefined,
    ) => {
      const { select, cursorFields } = getQuery(args, context, fieldQuery);

      return wrapConnectionResult(
        (parent as Record<string, unknown>)[name] as readonly {}[],
        args,
        select.limit,
        getCursorFormatter(cursorFields, schemaConfig),
        undefined,
        parent,
        countValue,
      );
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
          pothosDrizzleLoaded: (
            value: Record<string, unknown>,
            info: GraphQLResolveInfo,
            context: object,
          ) => {
            const { hasTotalCount, totalCountOnly } = connectionSelection(context, info);

            return (
              (!hasTotalCount || value[countKey] !== undefined) &&
              (totalCountOnly || value[name as string] !== undefined)
            );
          },
        },
        description,
        type: ref,
        resolve: (
          parent: unknown,
          args: PothosSchemaTypes.DefaultConnectionArguments,
          context: {},
          info: GraphQLResolveInfo,
        ) => {
          const parentRecord = parent as Record<string, unknown>;
          const countValue = totalCount
            ? (parentRecord[countKey] as number | undefined)
            : undefined;

          // Only totalCount was requested: the relation was never selected, so skip the cursors.
          if (connectionSelection(context, info).totalCountOnly) {
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

          // The same position the select path planned this field at, recorded alongside its
          // loader mapping, so a `query` that branches on its path pages the rows it selected.
          // Asked of `parent`, because that is whose rows are being paged: a sibling row of the
          // same list may have been loaded by a different plan, at a different position.
          const position = getLoaderMapping(
            context,
            info.path,
            info.parentType.name,
            parent,
          )?.position;
          const fieldQuery = resolveFieldQuery(args, context, position);

          return isThenable(fieldQuery)
            ? fieldQuery.then((resolved) =>
                resolveLoaded(resolved, parent, args, context, countValue),
              )
            : resolveLoaded(fieldQuery, parent, args, context, countValue);
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

    // Built once per field: the select allocates nothing when the nested selection is sync. The
    // nested selection already carries the field's `query` (it is merged into the child first),
    // so nothing is spread over it.
    const selectRelation = (nested: unknown) => ({ columns: {}, with: { [name]: nested } });
    const relationSelect = (
      args: object,
      context: object,
      nestedQuery: (query: unknown) => {},
      _resolveSelection: unknown,
      position: Position,
    ) =>
      completeValue(
        nestedQuery(
          typeof query === 'function'
            ? (query as (args: {}, context: {}, pathInfo?: PathInfo) => {})(
                args,
                context,
                pathInfoFor(position),
              )
            : query,
        ),
        selectRelation,
      );

    return this.field({
      ...(rest as {}),
      type: relationField instanceof Many ? [ref] : ref,
      extensions: {
        ...extensions,
        pothosDrizzleSelect: relationSelect as never,
        pothosDrizzleLoaded: (value: Record<string, unknown>) =>
          value[name as string] !== undefined,
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
    options: RelatedSelectionFieldOptions<
      Types,
      TableConfig,
      Type,
      Nullable,
      Args,
      Select,
      ShapeWithSelection
    >,
  ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'DrizzleObject'> {
    const schemaConfig = getSchemaConfig(this.builder);
    const relationField = schemaConfig.relations?.[this.table].relations[relationName as string];

    if (!relationField) {
      throw new PothosSchemaError(
        `Could not find relation ${relationName as string} on table ${this.table}`,
      );
    }

    const relationSelect = (
      args: object,
      context: Types['Context'],
      nestedQuery: (query: unknown) => unknown,
    ) => {
      const buildFilter = (parentTable: TableConfig['table']): SQL =>
        buildRelationFilter(
          getClient(this.builder, context) as never,
          relationField as Relation,
          parentTable as Table,
        ).filter;

      return completeValue(
        options.select(buildFilter as never, args as never, context, nestedQuery as never) as
          | MaybePromise<Select & { with?: unknown }>
          | undefined,
        pickSelection,
      );
    };

    const { select: _select, extensions, ...fieldOptions } = options;

    return this.field({
      ...fieldOptions,
      extensions: {
        ...extensions,
        pothosDrizzleSelect: relationSelect as never,
      },
      resolve: options.resolve as never,
    } as never) as never;
  }

  relatedCount<
    Field extends ListRelation<TableConfig>,
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
    // A related row counts once however many junction rows lead to it, which the count needs a
    // column identifying a target row to say. Without one it falls back to counting the target
    // table filtered by the relation, which says the same thing more slowly.
    const targetKey = schemaConfig.findPrimaryKey(relationField.targetTableName);
    const distinctBy = targetKey?.length === 1 ? targetKey[0] : undefined;

    // Built once per field; the `extras` function it returns is what the plan carried before.
    const countExtras = (
      whereClause: SQL | undefined,
      ctx: Types['Context'],
      buildFilter: (parent: TableConfig['table']) => SQL,
    ) =>
      ({
        extras: {
          [countKey]: (parent: TableConfig['table']) => {
            const client = getClient(this.builder, ctx);

            if (!distinctBy) {
              return client.$count(
                relatedTable.table as Table,
                whereClause ? and(buildFilter(parent), whereClause) : buildFilter(parent),
              );
            }

            return buildRelationFilter(
              client as never,
              relationField as Relation,
              parent as Table,
            ).countDistinctRows(distinctBy, whereClause);
          },
        },
      }) as never;

    return this.relatedField(relationName, {
      ...options,
      type: 'Int' as never,
      nullable: false,
      extensions: {
        ...(options as { extensions?: Record<string, unknown> }).extensions,
        pothosDrizzleLoaded: (value: Record<string, unknown>) => value[countKey] !== undefined,
      },
      select: (
        buildFilter: (parent: TableConfig['table']) => SQL,
        args: object,
        ctx: Types['Context'],
      ) => {
        const whereClause =
          typeof where === 'function'
            ? (where as (args: unknown, ctx: unknown) => MaybePromise<SQL | undefined>)(args, ctx)
            : where;

        return isThenable(whereClause)
          ? whereClause.then((resolved) =>
              countExtras(resolved as SQL | undefined, ctx, buildFilter),
            )
          : countExtras(whereClause, ctx, buildFilter);
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

/** A relation `query` callback may return nothing; the connection then adds no filter. */
function orEmpty<T extends object>(query: T | null | undefined): T {
  return query ?? ({} as T);
}

/** A `relatedField` select's map, with the columns it may have left out defaulted. */
function pickSelection(selection: { columns?: {}; extras?: unknown; with?: unknown } | undefined) {
  return {
    columns: selection?.columns ?? {},
    extras: selection?.extras,
    with: selection?.with,
  };
}
