import { outputShapeKey } from '../types';
import BaseTypeRef from './base';

export default class OutputTypeRef<T> extends BaseTypeRef {
  kind;

  [outputShapeKey]: T;

  constructor(kind: 'Enum' | 'Interface' | 'Object' | 'Scalar' | 'Union', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
