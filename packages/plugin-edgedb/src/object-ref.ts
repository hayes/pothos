import { ObjectRef, SchemaTypes } from '@pothos/core';
import type { EdgeDBModelTypes } from './types';

export const edgeDBModelKey = Symbol.for('Pothos.edgeDBModelKey');

export class EdgeDBObjectRef<
  Types extends SchemaTypes,
  Model extends EdgeDBModelTypes<Types>,
  T = {},
> extends ObjectRef<T> {
  [edgeDBModelKey]!: Model;
}
