import { inputShapeKey } from '../types';
import BaseTypeRef from './base';

export default class InputTypeRef<T> extends BaseTypeRef {
  kind;

  [inputShapeKey]: T;

  constructor(kind: 'Enum' | 'InputObject' | 'Scalar', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
