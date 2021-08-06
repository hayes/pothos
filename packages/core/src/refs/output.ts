import { outputShapeKey, parentShapeKey } from '../types/index.js';
import BaseTypeRef from './base.js';

export default class OutputTypeRef<T, P = T> extends BaseTypeRef {
  override kind;

  [outputShapeKey]: T;
  [parentShapeKey]: P;

  constructor(kind: 'Enum' | 'Interface' | 'Object' | 'Scalar' | 'Union', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
