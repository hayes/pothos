import { outputShapeKey, OutputRef, InputRef, inputShapeKey } from '../types';
import BaseTypeRef from './base';

export default class EnumRef<T, U = T> extends BaseTypeRef implements OutputRef, InputRef {
  kind = 'Enum' as const;

  name: string;

  [outputShapeKey]: T;

  [inputShapeKey]: U;

  constructor(name: string) {
    super();
    this.name = name;
  }
}
