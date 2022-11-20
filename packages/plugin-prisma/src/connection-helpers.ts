import { SchemaTypes } from '@pothos/core';
import { PrismaObjectRef } from './object-ref';
import type { PrismaModelTypes } from './types';
import {
  getCursorFormatter,
  getCursorParser,
  prismaCursorConnectionQuery,
  wrapConnectionResult,
} from './util/cursors';
import { getRefFromModel } from './util/datamodel';

export const prismaModelKey = Symbol.for('Pothos.prismaModelKey');

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  RefOrType extends PrismaObjectRef<PrismaModelTypes> | keyof Types['PrismaTypes'],
  Model extends PrismaModelTypes = RefOrType extends PrismaObjectRef<infer T>
    ? T & PrismaModelTypes
    : Types['PrismaTypes'][RefOrType & keyof Types['PrismaTypes']] & PrismaModelTypes,
  Shape = RefOrType extends PrismaObjectRef<PrismaModelTypes, infer T> ? T : Model['Shape'],
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrType: RefOrType,
  options: {
    cursor: string & keyof Model['WhereUnique'];
    defaultSize?:
      | number
      | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => number);
    maxSize?: number | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => number);
  },
) {
  const modelName =
    typeof refOrType === 'string' ? refOrType : (refOrType as PrismaObjectRef<Model>).modelName;
  const formatCursor = getCursorFormatter(modelName, builder, options.cursor);
  const parseCursor = getCursorParser(modelName, builder, options.cursor);

  function resolve(
    list: (Shape & {})[],
    args: PothosSchemaTypes.DefaultConnectionArguments,
    ctx: Types['Context'],
  ) {
    return wrapConnectionResult(list, args, getQuery(args, ctx).take, formatCursor);
  }

  function getQuery(args: PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) {
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

  return {
    ref: (typeof refOrType === 'string'
      ? getRefFromModel(refOrType, builder)
      : refOrType) as PrismaObjectRef<Model>,
    resolve,
    getQuery,
  };
}
