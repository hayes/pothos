import { inputShapeKey, InputRef } from '../types';

export default class InputObjectRef<T> implements InputRef {
  kind = 'InputObject' as const;

  name: string;

  [inputShapeKey]: T;

  constructor(name: string) {
    this.name = name;
  }
}
