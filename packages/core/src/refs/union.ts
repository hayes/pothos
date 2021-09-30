import { OutputRef, outputShapeKey, parentShapeKey } from '../types';
import BaseTypeRef from './base';

export default class UnionRef<T, P = T>
  extends BaseTypeRef
  implements OutputRef, GiraphQLSchemaTypes.UnionRef<T, P>
{
  override kind = 'Union' as const;

  [outputShapeKey]: T;
  [parentShapeKey]: P;

  constructor(name: string) {
    super('Union', name);
  }
}
