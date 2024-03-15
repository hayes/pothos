import {
  InputRef,
  inputShapeKey,
  OutputRef,
  outputShapeKey,
  parentShapeKey,
  PothosScalarTypeConfig,
  SchemaTypes,
} from '../types';
import { BaseTypeRef } from './base';
import { ListRef } from './list';
import { NonNullRef } from './non-null';

export class ScalarRef<Types extends SchemaTypes, T, U, P = T>
  extends BaseTypeRef<Types, PothosScalarTypeConfig>
  implements OutputRef, InputRef, PothosSchemaTypes.ScalarRef<Types, T, U, P>
{
  override kind = 'Scalar' as const;

  $inferType!: T;

  $inferInput!: U;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  [inputShapeKey]!: U;

  constructor(name: string, config?: PothosScalarTypeConfig) {
    super('Scalar', name, config);
  }

  list() {
    return new ListRef<Types, typeof this>(this);
  }

  nonNull() {
    return new NonNullRef<Types, typeof this>(this);
  }
}
