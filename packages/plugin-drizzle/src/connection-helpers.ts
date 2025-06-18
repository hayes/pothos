import type { InputFieldMap, InputShapeFromFields, SchemaTypes } from '@pothos/core';
import type {
  BuildQueryResult,
  DBQueryConfig,
  ExtractTablesWithRelations,
  RelationsFilter,
  TableRelationalConfig,
} from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import type { DrizzleRef } from './interface-ref';
import type { QueryForDrizzleConnection } from './types';
import { getSchemaConfig } from './utils/config';
import {
  drizzleCursorConnectionQuery,
  getCursorFormatter,
  wrapConnectionResult,
} from './utils/cursors';
import { queryFromInfo } from './utils/map-query';
import { getRefFromModel } from './utils/refs';
import { createState, mergeSelection, selectionToQuery } from './utils/selections';

export function drizzleConnectionHelpers<
  Types extends SchemaTypes,
  Type extends DrizzleRef<Types> | keyof Types['DrizzleRelationsConfig'],
  Selection extends DBQueryConfig<'one', Types['DrizzleRelationsConfig'], Table> | true,
  Table extends TableRelationalConfig = Types['DrizzleRelationsConfig'][Type extends DrizzleRef<
    Types,
    infer T
  >
    ? T
    : Type],
  Shape = Type extends DrizzleRef<
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    any,
    keyof Types['DrizzleRelationsConfig'],
    infer S
  >
    ? S
    : BuildQueryResult<Types['DrizzleRelationsConfig'], Table, true>,
  EdgeShape = true extends Selection
    ? Shape
    : BuildQueryResult<Types['DrizzleRelationsConfig'], Table, Selection>,
  NodeShape = EdgeShape,
  ExtraArgs extends InputFieldMap = {},
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrType: Type,
  {
    select,
    resolveNode,
    query,
    args: createArgs,
    maxSize = builder.options.drizzle?.maxConnectionSize,
    defaultSize = builder.options.drizzle?.defaultConnectionSize,
  }: {
    args?: (t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => ExtraArgs;
    select?: (
      nestedSelection: <T extends true | {}>(selection?: T) => T,
      args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
      ctx: Types['Context'],
    ) => Selection;
    query?: QueryForDrizzleConnection<Types, Table> extends infer QueryConfig
      ?
          | QueryConfig
          | ((args: InputShapeFromFields<ExtraArgs>, context: Types['Context']) => QueryConfig)
      : never;
    defaultSize?:
      | number
      | ((
          args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    maxSize?:
      | number
      | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) => number);
    resolveNode?: (edge: EdgeShape) => NodeShape;
  },
) {
  const config = getSchemaConfig(builder);
  const tableName =
    typeof refOrType === 'string'
      ? refOrType
      : (refOrType as DrizzleRef<Types, Type extends DrizzleRef<Types, infer T> ? T : Type>)
          .tableName;

  function resolve<Parent = undefined>(
    list: (EdgeShape & {})[],
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    parent?: Parent,
  ) {
    const { select, cursorColumns } = getQueryArgs(args, ctx);
    const formatCursor = getCursorFormatter(cursorColumns, config);
    return wrapConnectionResult(
      list,
      args,
      select.limit,
      formatCursor,
      (resolveNode as never) ?? ((edge: unknown) => edge),
      parent,
    ) as unknown as {
      parent: Parent;
      edges: (Omit<EdgeShape, 'cursor' | 'node'> & { node: NodeShape; cursor: string })[];
      pageInfo: {
        startCursor: string | null;
        endCursor: string | null;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      };
    };
  }

  const getQueryArgs = (
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: {},
  ) => {
    const { limit, orderBy, where, ...fieldQuery } =
      (typeof query === 'function' ? query(args, ctx) : query) ?? {};
    const table = config.relations.tablesConfig[tableName] as Table;

    const { cursorColumns, columns, ...connectionQuery } = drizzleCursorConnectionQuery({
      ctx,
      maxSize,
      defaultSize: typeof defaultSize === 'function' ? defaultSize(args, ctx) : defaultSize,
      args,
      orderBy:
        (typeof orderBy === 'function' ? orderBy(table) : orderBy) ??
        getSchemaConfig(builder).getPrimaryKey(tableName),
      where,
      config,
      table,
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

  type NestedSelection = <T extends true | {}>(selection?: T, path?: string[]) => T;

  function getQuery(
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    nestedSelectionOrInfo: NestedSelection | GraphQLResolveInfo,
  ) {
    const nestedSelection: NestedSelection =
      typeof nestedSelectionOrInfo === 'function'
        ? nestedSelectionOrInfo
        : (select, path) =>
            queryFromInfo({
              info: nestedSelectionOrInfo,
              context: ctx,
              config,
              select,
              path,
            });
    const nestedSelect: Record<string, unknown> | true = select
      ? select((sel) => nestedSelection(sel, ['edges', 'node']), args, ctx)
      : nestedSelection(true, ['edges', 'node']);
    const queryArgs = getQueryArgs(args, ctx);

    const selectState = createState(
      config.relations.tablesConfig[tableName],
      builder.options.drizzle?.skipDeferredFragments ?? true,
    );

    mergeSelection(config, selectState, queryArgs.select);

    if (typeof nestedSelect === 'object' && nestedSelect) {
      mergeSelection(config, selectState, nestedSelect);
    }

    const baseQuery = typeof query === 'function' ? query(args, ctx) : (query ?? {});
    const queryResult = selectionToQuery(config, selectState);

    return {
      ...baseQuery,
      ...queryResult,
    } as unknown as Omit<Selection, 'orderBy'> & {
      orderBy: {
        [K in keyof Table['columns']]?: 'asc' | 'desc' | undefined;
      };
      where: RelationsFilter<Table, ExtractTablesWithRelations<Types['DrizzleRelations']>>;
    };
  }

  const getArgs = () => (createArgs ? builder.args(createArgs) : {}) as ExtraArgs;

  return {
    ref: (typeof refOrType === 'string'
      ? getRefFromModel(refOrType, builder)
      : refOrType) as DrizzleRef<Types, Type extends DrizzleRef<Types, infer T> ? T : Type, Shape>,
    resolve,
    select: select ?? {},
    getQuery,
    getArgs,
  };
}
