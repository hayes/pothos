import { InputRef, inputShapeKey, OutputRef, outputShapeKey, parentShapeKey } from '../types';
import BaseTypeRef from './base';

export default class ScalarRef<T, U, P = T>
  extends BaseTypeRef
  implements OutputRef, InputRef, PothosSchemaTypes.ScalarRef<T, U, P>
{
  override kind = 'Scalar' as const;

  [outputShapeKey]!: T;
  [parentShapeKey]!: P;

  [inputShapeKey]!: U;

  constructor(name: string) {
    super('Scalar', name);
  }
}
