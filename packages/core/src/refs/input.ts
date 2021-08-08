import { inputShapeKey } from '../types/index.js';
import BaseTypeRef from './base.js';

export default class InputTypeRef<T> extends BaseTypeRef {
  override kind;

  [inputShapeKey]: T;

  constructor(kind: 'Enum' | 'InputObject' | 'Scalar', name: string) {
    super(kind, name);
    this.kind = kind;
  }
}
