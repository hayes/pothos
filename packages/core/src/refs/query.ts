import type { SchemaTypes } from '../types/index.js';
import { ObjectRef } from './object.js';

export class QueryRef<Types extends SchemaTypes> extends ObjectRef<Types, Types['Root']> {}
