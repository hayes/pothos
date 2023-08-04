import { ObjectRef, SchemaTypes } from '@pothos/core';
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
  RefOrType extends PrismaRef<PrismaModelTypes> | keyof Types['PrismaTypes'],
  Select extends Model['Select'] & {},
  Model extends PrismaModelTypes = RefOrType extends PrismaRef<infer T>
    ? T & PrismaModelTypes
    : Types['PrismaTypes'][RefOrType & keyof Types['PrismaTypes']] & PrismaModelTypes,
  Shape = RefOrType extends PrismaRef<PrismaModelTypes, infer T> ? T : Model['Shape'],
  EdgeShape = Model['Include'] extends Select
    ? Shape
    : ShapeFromSelection<Types, Model, { select: Select }>,
  NodeShape = EdgeShape,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrType: RefOrType,
  options: {
    cursor: UniqueFieldsFromWhereUnique<Model['WhereUnique']>;
    select?: (nestedSelection: <T extends {} | true>(selection?: T) => T) => Select;
    defaultSize?:
      | number
      | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => number);
    maxSize?: number | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => number);
    resolveNode?: (edge: EdgeShape) => NodeShape;
  },
) {
  const modelName =
    typeof refOrType === 'string' ? refOrType : (refOrType as PrismaRef<Model>).modelName;
  const ref =
    typeof refOrType === 'string'
      ? getRefFromModel(modelName, builder)
      : (refOrType as ObjectRef<unknown>);
  const formatCursor = getCursorFormatter(modelName, builder, options.cursor);
  const parseCursor = getCursorParser(modelName, builder, options.cursor);
  const cursorSelection = ModelLoader.getCursorSelection(ref, modelName, options.cursor, builder);
  const fieldMap = getRelationMap(getDMMF(builder)).get(modelName)!;

  function resolve<Parent = unknown>(
    list: (EdgeShape & {})[],
    args: PothosSchemaTypes.DefaultConnectionArguments,
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
      (options?.resolveNode as never) ?? ((edge: unknown) => edge),
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

  function getQueryArgs(args: PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) {
    return prismaCursorConnectionQuery({
      args,
      ctx,
      maxSize: typeof options.maxSize === 'function' ? options.maxSize(args, ctx) : options.maxSize,
      defaultSize:
        typeof options.defaultSize === 'function'
          ? options.defaultSize(args, ctx)
          : options.defaultSize,
      parseCursor,
    });
  }

  function getQuery(
    args: PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
    nestedSelection: <T extends true | {}>(selection?: T, path?: string[]) => T,
  ) {
    const nestedSelect: Record<string, unknown> | true = options.select
      ? { select: options.select((sel) => nestedSelection(sel, ['edges', 'node'])) }
      : nestedSelection(true, ['edges', 'node']);

    const selectState = createState(fieldMap, 'select');

    mergeSelection(selectState, { select: cursorSelection });

    if (typeof nestedSelect === 'object' && nestedSelect) {
      mergeSelection(selectState, nestedSelect);
    }

    return {
      ...getQueryArgs(args, ctx),
      ...selectionToQuery(selectState),
    } as unknown as {
      skip?: number;
      take?: number;
      cursor?: Model['WhereUnique'];
    } & (Model['Select'] extends Select ? {} : { select: Select });
  }

  return {
    ref: (typeof refOrType === 'string'
      ? getRefFromModel(refOrType, builder)
      : refOrType) as PrismaRef<Model>,
    resolve,
    select: options.select ?? {},
    getQuery,
  };
}
