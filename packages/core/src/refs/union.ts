import { outputShapeKey, OutputRef } from '../types';

export default class UnionRef<T> implements OutputRef {
  kind = 'Union' as const;

  name: string;

  [outputShapeKey]: T;

  constructor(name: string) {
    this.name = name;
  }
}
