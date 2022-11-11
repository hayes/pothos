import { ObjectRef, SchemaTypes } from '@pothos/core';
import type { ShapeFromConnection } from './types';
import { prismaCursorConnectionQuery, wrapConnectionResult } from './util/cursors';

export const prismaModelKey = Symbol.for('Pothos.prismaModelKey');

export interface PrismaConnectionRefOptions<T> {
  name: string;
  defaultSize?: number | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => number);
  maxSize?: number | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: {}) => number);
  parseCursor: (rawCursor: string) => Record<string, unknown>;
  formatCursor: (value: T) => string;
}

export class PrismaConnectionRef<Types extends SchemaTypes, T extends {} = {}> extends ObjectRef<
  ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, T, false>>
> {
  private options: PrismaConnectionRefOptions<T>;

  constructor(options: PrismaConnectionRefOptions<T>) {
    super(options.name);
    this.options = options;
  }

  resolve(list: T[], args: PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) {
    return wrapConnectionResult(
      list,
      args,
      this.getQuery(args, ctx).take,
      this.options.formatCursor,
    );
  }

  getQuery(args: PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) {
    return prismaCursorConnectionQuery({
      args,
      ctx,
      maxSize:
        typeof this.options.maxSize === 'function'
          ? this.options.maxSize(args, ctx)
          : this.options.maxSize,
      defaultSize:
        typeof this.options.defaultSize === 'function'
          ? this.options.defaultSize(args, ctx)
          : this.options.defaultSize,
      parseCursor: this.options.parseCursor,
    });
  }
}
