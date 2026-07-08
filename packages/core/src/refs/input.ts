import { inputShapeKey, type SchemaTypes } from '../types/index.js';
import { BaseTypeRef } from './base.js';

export class InputTypeRef<Types extends SchemaTypes, T> extends BaseTypeRef<Types> {
  override kind;

  $inferInput!: T;

  [inputShapeKey]!: T;

  constructor(kind: 'Enum' | 'InputObject' | 'Scalar', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
