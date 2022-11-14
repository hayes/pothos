import { InputRef, inputShapeKey } from '../types';

export default class InputObjectRef<T> implements PothosSchemaTypes.InputListRef<T> {
  kind = 'InputList' as const;

  [inputShapeKey]!: T;
  listType: InputRef;

  constructor(listType: InputRef) {
    this.listType = listType;
  }
}
