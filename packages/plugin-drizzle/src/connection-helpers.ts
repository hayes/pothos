import type { InputFieldMap, InputShapeFromFields, SchemaTypes } from '@pothos/core';
import type { BuildQueryResult, DBQueryConfig } from 'drizzle-orm';
import type { DrizzleRef } from './interface-ref';
import { getSchemaConfig } from './utils/config';
import {
  drizzleCursorConnectionQuery,
  getCursorFormatter,
  wrapConnectionResult,
} from './utils/cursors';
import { getRefFromModel } from './utils/refs';
import { createState, mergeSelection, selectionToQuery } from './utils/selections';

export function drizzleConnectionHelpers<
  Types extends SchemaTypes,
  Type extends DrizzleRef<Types> | keyof Types['DrizzleRelationsConfig'],
  Selection extends
    | DBQueryConfig<
        'one',
        Types['DrizzleRelationsConfig'],
        Types['DrizzleRelationsConfig'][Type extends DrizzleRef<Types, infer T> ? T : Type]
      >
    | true,
  Shape = Type extends DrizzleRef<
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    any,
    keyof Types['DrizzleRelationsConfig'],
    infer S
  >
    ? S
    : BuildQueryResult<
        Types['DrizzleRelationsConfig'],
        Types['DrizzleRelationsConfig'][Type & keyof Types['DrizzleRelationsConfig']],
        true
      >,
  EdgeShape = true extends Selection
    ? Shape
    : BuildQueryResult<
        Types['DrizzleRelationsConfig'],
        Types['DrizzleRelationsConfig'][Type extends DrizzleRef<Types, infer T> ? T : Type],
        Selection
      >,
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
    select?: (
      nestedSelection: <T extends true | {}>(selection?: T) => T,
      args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
      ctx: Types['Context'],
    ) => Selection;
    query?: Omit<
      DBQueryConfig<
        'many',
        Types['DrizzleRelationsConfig'],
        Types['DrizzleRelationsConfig'][Type extends DrizzleRef<Types, infer T> ? T : Type]
      >,
      'columns' | 'extra' | 'with'
    > extends infer QueryConfig
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
    args?: (t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => ExtraArgs;
  },
) {
  const config = getSchemaConfig(builder);
  const tableName =
    typeof refOrType === 'string'
      ? refOrType
      : (refOrType as DrizzleRef<Types, Type extends DrizzleRef<Types, infer T> ? T : Type>)
          .tableName;

  function resolve<Parent = unknown>(
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

    const { cursorColumns, columns, ...connectionQuery } = drizzleCursorConnectionQuery({
      ctx,
      maxSize,
      defaultSize: typeof defaultSize === 'function' ? defaultSize(args, ctx) : defaultSize,
      args,
      orderBy: orderBy
        ? typeof orderBy === 'function'
          ? orderBy(tableName)
          : orderBy
        : getSchemaConfig(builder).getPrimaryKey(tableName),
      where,
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

  function getQuery(
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    nestedSelection: <T extends true | {}>(selection?: T, path?: string[]) => T,
  ) {
    const nestedSelect: Record<string, unknown> | true = select
      ? { select: select((sel) => nestedSelection(sel, ['edges', 'node']), args, ctx) }
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

    return {
      ...baseQuery,
      ...selectionToQuery(config, selectState),
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
