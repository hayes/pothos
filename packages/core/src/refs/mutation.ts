import type { SchemaTypes } from '../types/index.js';
import { ObjectRef } from './object.js';

export class MutationRef<Types extends SchemaTypes> extends ObjectRef<Types, Types['Root']> {
  override kind = 'Object' as const;
}
