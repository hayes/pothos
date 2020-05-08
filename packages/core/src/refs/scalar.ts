import { outputShapeKey, OutputRef, InputRef, inputShapeKey } from '../types';

export default class ScalarRef<T, U> implements OutputRef, InputRef {
  kind = 'Scalar' as const;

  name: string;

  [outputShapeKey]: T;

  [inputShapeKey]: U;

  constructor(name: string) {
    this.name = name;
  }
}
