import { outputShapeKey, OutputRef } from '../types';

export default class ObjectRef<T> implements OutputRef {
  kind = 'Object' as const;

  name: string;

  [outputShapeKey]: T;

  constructor(name: string) {
    this.name = name;
  }
}
