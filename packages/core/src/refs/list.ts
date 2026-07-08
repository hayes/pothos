import {
  outputShapeKey,
  parentShapeKey,
  type SchemaTypes,
  type TypeParam,
} from '../types/index.js';
import { BaseTypeRef } from './base.js';

export class ListRef<Types extends SchemaTypes, T, P = T>
  extends BaseTypeRef<Types>
  implements PothosSchemaTypes.ListRef<Types, T, P>
{
  override kind = 'List' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  listType: TypeParam<Types>;

  nullable: boolean;

  constructor(listType: TypeParam<Types>, nullable: boolean) {
    super('List', `List<${String(listType)}>`);
    this.listType = listType;
    this.nullable = nullable;
  }
}
