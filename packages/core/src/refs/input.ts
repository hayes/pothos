import { inputShapeKey, SchemaTypes } from '../types';
import { BaseTypeRef } from './base';

export class InputTypeRef<Types extends SchemaTypes, T> extends BaseTypeRef<Types> {
  override kind;

  $inferInput!: T;

  [inputShapeKey]!: T;

  constructor(kind: 'Enum' | 'InputObject' | 'Scalar', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
