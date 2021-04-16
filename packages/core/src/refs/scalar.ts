import { InputRef, inputShapeKey, OutputRef, outputShapeKey } from '../types';
import BaseTypeRef from './base';

export default class ScalarRef<T, U> extends BaseTypeRef implements OutputRef, InputRef {
  kind = 'Scalar' as const;

  [outputShapeKey]: T;

  [inputShapeKey]: U;

  constructor(name: string) {
    super('Scalar', name);
  }
}
