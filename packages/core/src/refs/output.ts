import { outputShapeKey, parentShapeKey, type SchemaTypes } from '../types/index.js';
import { BaseTypeRef } from './base.js';

export class OutputTypeRef<Types extends SchemaTypes, T, P = T> extends BaseTypeRef<Types> {
  override kind;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  constructor(kind: 'Enum' | 'Interface' | 'Object' | 'Scalar' | 'Union', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
