import type { GraphQLScalarType } from 'graphql';
import type { SchemaTypes } from '../types/index.js';
import { ScalarRef } from './scalar.js';

export class BuiltinScalarRef<Types extends SchemaTypes, T, U> extends ScalarRef<Types, T, U> {
  type;

  constructor(type: GraphQLScalarType) {
    super(type.name);

    this.type = type;
  }
}
