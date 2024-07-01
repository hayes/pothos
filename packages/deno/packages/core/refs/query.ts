// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import { ObjectRef } from './object.ts';
export class QueryRef<Types extends SchemaTypes> extends ObjectRef<Types, Types["Root"]> {
}
