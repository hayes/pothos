import { OutputRef, outputShapeKey, parentShapeKey } from '../types/type-params';
import BaseTypeRef from './base';

export default class UnionRef<T, P = T>
  extends BaseTypeRef
  implements OutputRef, PothosSchemaTypes.UnionRef<T, P>
{
  override kind = 'Union' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  constructor(name: string) {
    super('Union', name);
  }
}
