import { SchemaTypes } from '../types';
import { ObjectRef } from './object';

export class QueryRef<Types extends SchemaTypes> extends ObjectRef<Types, Types['Root']> {}
