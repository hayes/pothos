import { inputShapeKey, InputTypeParam, SchemaTypes } from '../types';
import BaseTypeRef from './base';

export default class InputObjectRef<Types extends SchemaTypes, T>
  extends BaseTypeRef
  implements PothosSchemaTypes.InputListRef<Types, T>
{
  override kind = 'InputList' as const;

  [inputShapeKey]!: T;
  listType: InputTypeParam<Types>;

  constructor(listType: InputTypeParam<Types>) {
    super('InputList', `InputList<${String(listType)}>`);
    this.listType = listType;
  }
}
