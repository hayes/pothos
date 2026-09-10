import {
  completeValue,
  type InputFieldMap,
  type InputShapeFromFields,
  isThenable,
  type MaybePromise,
  type ObjectRef,
  type SchemaTypes,
} from '@pothos/core';
import type { PathSegment } from '@pothos/selection-mapper';
import type { PrismaRef } from './interface-ref.js';
import { ModelLoader } from './model-loader.js';
import type {
  PrismaModelTypes,
  SelectionMap,
  ShapeFromSelection,
  UniqueFieldsFromWhereUnique,
} from './types.js';
import { prismaAdapter } from './util/adapter.js';
import {
  getCursorFormatter,
  getCursorParser,
  prismaCursorConnectionQuery,
  wrapConnectionResult,
} from './util/cursors.js';
import { getRefFromModel } from './util/datamodel.js';
import { getDMMF } from './util/get-client.js';
import { getRelationMap } from './util/relation-map.js';

function wrapSelect(selected: unknown) {
  return { select: selected };
}

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  RefOrType extends PrismaRef<Types, PrismaModelTypes> | keyof Types['PrismaTypes'],
  Select extends Model['Select'] & {},
  Model extends PrismaModelTypes = RefOrType extends PrismaRef<Types, infer T>
    ? PrismaModelTypes & T
    : PrismaModelTypes & Types['PrismaTypes'][RefOrType & keyof Types['PrismaTypes']],
  Shape = RefOrType extends PrismaRef<Types, PrismaModelTypes, infer T> ? T : Model['Shape'],
  EdgeShape = Model['Include'] extends Select
    ? Shape
    : ShapeFromSelection<Types, Model, { select: Select }>,
  NodeShape = EdgeShape,
  ExtraArgs extends InputFieldMap = {},
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrType: RefOrType,
  {
    cursor,
    select,
    resolveNode,
    query,
    args: createArgs,
    maxSize = builder.options.prisma?.maxConnectionSize,
    defaultSize = builder.options.prisma?.defaultConnectionSize,
  }: {
    cursor: UniqueFieldsFromWhereUnique<Model['WhereUnique']>;
    select?: (
      // The node's selection: its model is the connection field's, which the helper does not know.
      nestedSelection: <T extends true | {}>(selection?: T) => T,
      args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
      ctx: Types['Context'],
    ) => MaybePromise<Select>;
    query?:
      | ((
          args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => MaybePromise<{
          where?: Model['Where'];
          orderBy?: Model['OrderBy'];
        }>)
      | {
          where?: Model['Where'];
          orderBy?: Model['OrderBy'];
        };
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
  const modelName =
    typeof refOrType === 'string' ? refOrType : (refOrType as PrismaRef<Types, Model>).modelName;
  const ref =
    typeof refOrType === 'string'
      ? getRefFromModel(modelName, builder)
      : (refOrType as ObjectRef<Types, unknown>);

  const formatCursor = getCursorFormatter(modelName, builder, cursor);
  const parseCursor = getCursorParser(modelName, builder, cursor);
  const cursorSelection = ModelLoader.getCursorSelection(ref, modelName, cursor, builder);
  const fieldMap = getRelationMap(getDMMF(builder)).get(modelName)!;

  function resolve<Parent = unknown>(
    list: (EdgeShape & {})[],
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    parent?: Parent,
  ) {
    return wrapConnectionResult(
      parent,
      list,
      args,
      getQueryArgs(args, ctx).take,
      formatCursor,
      null,
      (resolveNode as never) ?? ((edge: unknown) => edge),
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

  function getQueryArgs(
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
  ) {
    // Resolved here rather than left to `prismaCursorConnectionQuery`: the helper's callbacks
    // also see the extra args, which that signature does not carry.
    return prismaCursorConnectionQuery({
      args,
      ctx,
      maxSize: typeof maxSize === 'function' ? maxSize(args, ctx) : maxSize,
      defaultSize: typeof defaultSize === 'function' ? defaultSize(args, ctx) : defaultSize,
      parseCursor,
    });
  }

  function getQuery(
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    // The `nestedSelection` of the field's `select`, whatever model its type names.
    nestedSelection: (selection?: SelectionMap | true, path?: PathSegment[]) => unknown,
  ) {
    // Both callbacks start now; the query waits for whichever of them is async (A-3, A-7: the
    // declared type stays synchronous, so an async schema awaits the result).
    const nestedSelect: MaybePromise<Record<string, unknown> | true> = select
      ? completeValue(
          select(
            (sel) => nestedSelection(sel as SelectionMap, ['edges', 'node']) as never,
            args,
            ctx,
          ),
          wrapSelect,
        )
      : (nestedSelection(true, ['edges', 'node']) as never);
    const baseQuery = typeof query === 'function' ? query(args, ctx) : (query ?? {});

    return (isThenable(nestedSelect) || isThenable(baseQuery)
      ? Promise.all([nestedSelect, baseQuery]).then(([nested, base]) =>
          buildQuery(nested, base, args, ctx),
        )
      : buildQuery(
          nestedSelect,
          baseQuery,
          args,
          ctx,
        )) as unknown as (Model['Select'] extends Select ? {} : { select: Select }) & {
      where?: Model['Where'];
      orderBy?: Model['OrderBy'];
      skip?: number;
      take?: number;
      cursor?: Model['WhereUnique'];
    };
  }

  // Built once per helper, so a synchronous `getQuery` allocates nothing beyond the query.
  function buildQuery(
    nestedSelect: Record<string, unknown> | true,
    baseQuery: object,
    args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
  ) {
    const node = prismaAdapter.create(fieldMap);

    prismaAdapter.merge(node, { select: cursorSelection });

    if (typeof nestedSelect === 'object' && nestedSelect) {
      prismaAdapter.merge(node, nestedSelect);
    }

    return {
      ...baseQuery,
      ...getQueryArgs(args, ctx),
      ...prismaAdapter.emit(node),
    };
  }

  const getArgs = () => (createArgs ? builder.args(createArgs) : {}) as ExtraArgs;

  return {
    ref: ref as PrismaRef<Types, Model, Model['Shape']>,
    resolve,
    select: select ?? {},
    getQuery,
    getArgs,
  };
}
