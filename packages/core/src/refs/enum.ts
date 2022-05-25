import { InputRef, inputShapeKey, OutputRef, outputShapeKey } from '../types';
import BaseTypeRef from './base';

export default class EnumRef<T, U = T>
  extends BaseTypeRef
  implements OutputRef, InputRef, PothosSchemaTypes.EnumRef<T, U>
{
  override kind = 'Enum' as const;

  [outputShapeKey]!: T;

  [inputShapeKey]!: U;

  constructor(name: string) {
    super('Enum', name);
  }
}
