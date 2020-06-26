import { outputShapeKey, OutputRef, InputRef, inputShapeKey } from '../types';
import BaseTypeRef from './base';

export default class ScalarRef<T, U> extends BaseTypeRef implements OutputRef, InputRef {
  kind = 'Scalar' as const;

  name: string;

  [outputShapeKey]: T;

  [inputShapeKey]: U;

  constructor(name: string) {
    super();
    this.name = name;
  }
}
