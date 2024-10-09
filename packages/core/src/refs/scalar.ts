import {
  type InputRef,
  type OutputRef,
  type PothosScalarTypeConfig,
  type SchemaTypes,
  inputShapeKey,
  outputShapeKey,
  parentShapeKey,
} from '../types';
import { BaseTypeRef } from './base';

export class ScalarRef<Types extends SchemaTypes, T, U, P = T>
  extends BaseTypeRef<Types, PothosScalarTypeConfig>
  implements OutputRef<T>, InputRef<U>, PothosSchemaTypes.ScalarRef<Types, T, U, P>
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
}
