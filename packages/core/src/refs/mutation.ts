import { SchemaTypes } from '../types';
import { ObjectRef } from './object';

export class MutationRef<Types extends SchemaTypes> extends ObjectRef<Types, Types['Root']> {
  override kind = 'Object' as const;
}
