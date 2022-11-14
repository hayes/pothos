import { OutputRef, outputShapeKey, parentShapeKey } from '../types';

export default class ListRef<T, P = T> implements PothosSchemaTypes.ListRef<T, P> {
  kind = 'List' as const;

  [outputShapeKey]!: T;
  [parentShapeKey]!: P;

  listType: OutputRef<unknown>;

  constructor(listType: OutputRef) {
    this.listType = listType;
  }
}
