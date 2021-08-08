import {
  InputRef,
  inputShapeKey,
  OutputRef,
  outputShapeKey,
  parentShapeKey,
} from '../types/index.js';
import BaseTypeRef from './base.js';

export default class ScalarRef<T, U, P = T> extends BaseTypeRef implements OutputRef, InputRef {
  override kind = 'Scalar' as const;

  [outputShapeKey]: T;
  [parentShapeKey]: P;

  [inputShapeKey]: U;

  constructor(name: string) {
    super('Scalar', name);
  }
}
