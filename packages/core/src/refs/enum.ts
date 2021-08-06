import { InputRef, inputShapeKey, OutputRef, outputShapeKey } from '../types/index.js';
import BaseTypeRef from './base.js';

export default class EnumRef<T, U = T> extends BaseTypeRef implements OutputRef, InputRef {
  override kind = 'Enum' as const;

  [outputShapeKey]: T;

  [inputShapeKey]: U;

  constructor(name: string) {
    super('Enum', name);
  }
}
