import { outputShapeKey, parentShapeKey, SchemaTypes } from '../types';
import { BaseTypeRef } from './base';

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
