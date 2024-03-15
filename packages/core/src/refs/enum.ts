import {
  InputRef,
  inputShapeKey,
  OutputRef,
  outputShapeKey,
  PothosEnumTypeConfig,
  SchemaTypes,
} from '../types';
import { BaseTypeRef } from './base';
import { ListRef } from './list';
import { NonNullRef } from './non-null';

export class EnumRef<Types extends SchemaTypes, T, U = T>
  extends BaseTypeRef<Types, PothosEnumTypeConfig>
  implements OutputRef, InputRef, PothosSchemaTypes.EnumRef<Types, T, U>
{
  override kind = 'Enum' as const;

  $inferType!: T;

  $inferInput!: U;

  [outputShapeKey]!: T;

  [inputShapeKey]!: U;

  constructor(name: string, config?: PothosEnumTypeConfig) {
    super('Enum', name, config);
  }

  list() {
    return new ListRef<Types, typeof this>(this);
  }

  nonNull() {
    return new NonNullRef<Types, typeof this>(this);
  }
}
