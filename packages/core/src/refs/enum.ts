import {
  type InputRef,
  type OutputRef,
  type PothosEnumTypeConfig,
  type SchemaTypes,
  inputShapeKey,
  outputShapeKey,
} from '../types';
import { BaseTypeRef } from './base';

export class EnumRef<Types extends SchemaTypes, T, U = T>
  extends BaseTypeRef<Types, PothosEnumTypeConfig>
  implements OutputRef<T>, InputRef<U>, PothosSchemaTypes.EnumRef<Types, T, U>
{
  override kind = 'Enum' as const;

  $inferType!: T;

  $inferInput!: U;

  [outputShapeKey]!: T;

  [inputShapeKey]!: U;

  constructor(name: string, config?: PothosEnumTypeConfig) {
    super('Enum', name, config);
  }
}
