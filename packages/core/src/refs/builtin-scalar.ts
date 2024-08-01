import type { GraphQLScalarType } from 'graphql';
import type { SchemaTypes } from '../types';
import { ScalarRef } from './scalar';

export class BuiltinScalarRef<Types extends SchemaTypes, T, U> extends ScalarRef<Types, T, U> {
  type;

  constructor(type: GraphQLScalarType) {
    super(type.name);

    this.type = type;
  }
}
