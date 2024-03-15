// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import { ObjectRef } from './object.ts';
export class MutationRef<Types extends SchemaTypes> extends ObjectRef<Types, Types["Root"]> {
    override kind = "Object" as const;
}
