import { outputShapeKey, parentShapeKey } from '../types';
import BaseTypeRef from './base';

export default class OutputTypeRef<T, P = T> extends BaseTypeRef {
  override kind;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  constructor(kind: 'Enum' | 'Interface' | 'Object' | 'Scalar' | 'Union', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
