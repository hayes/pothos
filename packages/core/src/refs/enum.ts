import { outputShapeKey, OutputRef, InputRef, inputShapeKey } from '../types';

export default class EnumRef<T, U = T> implements OutputRef, InputRef {
  kind = 'Enum' as const;

  name: string;

  [outputShapeKey]: T;

  [inputShapeKey]: U;

  constructor(name: string) {
    this.name = name;
  }
}
