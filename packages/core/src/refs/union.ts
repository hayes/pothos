import { outputShapeKey, OutputRef } from '../types';
import BaseTypeRef from './base';

export default class UnionRef<T> extends BaseTypeRef implements OutputRef {
  kind = 'Union' as const;

  name: string;

  [outputShapeKey]: T;

  constructor(name: string) {
    super();
    this.name = name;
  }
}
