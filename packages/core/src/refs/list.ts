import { outputShapeKey, parentShapeKey, SchemaTypes, TypeParam } from '../types';
import { BaseTypeRef } from './base';

export class ListRef<Types extends SchemaTypes, T, P = T>
  extends BaseTypeRef<Types>
  implements PothosSchemaTypes.ListRef<Types, T, P>
{
  override kind = 'List' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  listType: TypeParam<Types>;

  nonNull: boolean;

  constructor(listType: TypeParam<Types>, nonNull: boolean) {
    super('List', `List<${String(listType)}>`);
    this.listType = listType;
    this.nonNull = nonNull;
  }
}
