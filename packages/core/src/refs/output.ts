import { outputShapeKey } from '../types';
import BaseTypeRef from './base';

export default class OutputTypeRef<T> extends BaseTypeRef {
  kind;

  [outputShapeKey]: T;

  constructor(kind: 'Object' | 'Interface' | 'Union' | 'Enum' | 'Scalar', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
