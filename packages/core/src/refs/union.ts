import { OutputRef, outputShapeKey, parentShapeKey } from '../types/index.js';
import BaseTypeRef from './base.js';

export default class UnionRef<T, P = T> extends BaseTypeRef implements OutputRef {
  override kind = 'Union' as const;

  [outputShapeKey]: T;
  [parentShapeKey]: P;

  constructor(name: string) {
    super('Union', name);
  }
}
