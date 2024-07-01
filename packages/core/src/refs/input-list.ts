import { inputShapeKey, InputTypeParam, SchemaTypes } from '../types';
import { BaseTypeRef } from './base';

export class InputListRef<Types extends SchemaTypes, T>
  extends BaseTypeRef<Types>
  implements PothosSchemaTypes.InputListRef<Types, T>
{
  override kind = 'InputList' as const;

  [inputShapeKey]!: T;

  $inferInput!: T;

  listType: InputTypeParam<Types>;

  required: boolean;

  constructor(listType: InputTypeParam<Types>, required: boolean) {
    super('InputList', `InputList<${String(listType)}>`);
    this.listType = listType;
    this.required = required;
  }
}
