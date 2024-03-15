import { inputShapeKey, SchemaTypes } from '../types';
import { BaseTypeRef } from './base';
import { ListRef } from './list';
import { NonNullRef } from './non-null';

export class InputTypeRef<Types extends SchemaTypes, T> extends BaseTypeRef<Types> {
  override kind;

  $inferInput!: T;

  [inputShapeKey]!: T;

  constructor(kind: 'Enum' | 'InputObject' | 'Scalar', name: string) {
    super(kind, name);
    this.kind = kind;
  }

  list() {
    return new ListRef<Types, typeof this>(this);
  }

  nonNull() {
    return new NonNullRef<Types, typeof this>(this);
  }
}
