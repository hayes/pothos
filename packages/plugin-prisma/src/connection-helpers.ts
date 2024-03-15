import { InputFieldMap, InputShapeFromFields, ObjectRef, SchemaTypes } from '@pothos/core';
import { PrismaRef } from './interface-ref';
import { ModelLoader } from './model-loader';
import type { PrismaModelTypes, ShapeFromSelection, UniqueFieldsFromWhereUnique } from './types';
import {
  getCursorFormatter,
  getCursorParser,
  prismaCursorConnectionQuery,
  wrapConnectionResult,
} from './util/cursors';
import { getRefFromModel } from './util/datamodel';
import { getDMMF } from './util/get-client';
import { getRelationMap } from './util/relation-map';
import { createState, mergeSelection, selectionToQuery } from './util/selections';

export const prismaModelKey = Symbol.for('Pothos.prismaModelKey');

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
      nestedSelection: <T extends true | {}>(selection?: T) => T,
      args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
      ctx: Types['Context'],
    ) => Select;
    query?:
      | ((
          args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => {
          where?: Model['Where'];
          orderBy?: Model['OrderBy'];
        })
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
    nestedSelection: <T extends true | {}>(selection?: T, path?: string[]) => T,
  ) {
    const nestedSelect: Record<string, unknown> | true = select
      ? { select: select((sel) => nestedSelection(sel, ['edges', 'node']), args, ctx) }
      : nestedSelection(true, ['edges', 'node']);

    const selectState = createState(fieldMap, 'select');

    mergeSelection(selectState, { select: cursorSelection });

    if (typeof nestedSelect === 'object' && nestedSelect) {
      mergeSelection(selectState, nestedSelect);
    }

    const baseQuery = typeof query === 'function' ? query(args, ctx) : query ?? {};

    return {
      ...baseQuery,
      ...getQueryArgs(args, ctx),
      ...selectionToQuery(selectState),
    } as unknown as (Model['Select'] extends Select ? {} : { select: Select }) & {
      where?: Model['Where'];
      orderBy?: Model['OrderBy'];
      skip?: number;
      take?: number;
      cursor?: Model['WhereUnique'];
    };
  }

  const getArgs = () => (createArgs ? builder.args(createArgs) : {}) as ExtraArgs;

  return {
    ref: (typeof refOrType === 'string'
      ? getRefFromModel(refOrType, builder)
      : refOrType) as PrismaRef<Types, Model, Model['Shape']>,
    resolve,
    select: select ?? {},
    getQuery,
    getArgs,
  };
}
