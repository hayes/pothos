import { ObjectRef } from '@pothos/core';
import type { EdgeDBModelTypes } from './types';

export const edgeDBModelKey = Symbol.for('Pothos.edgeDBModelKey');

export class EdgeDBObjectRef<Model extends EdgeDBModelTypes, T = {}> extends ObjectRef<T> {
  [edgeDBModelKey]!: Model;
}
