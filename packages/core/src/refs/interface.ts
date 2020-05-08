import { outputShapeKey, OutputRef } from '../types';

export default class InterfaceRef<T> implements OutputRef {
  kind = 'Interface' as const;

  name: string;

  [outputShapeKey]: T;

  constructor(name: string) {
    this.name = name;
  }
}
