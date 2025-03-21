// @ts-nocheck
import type { SchemaTypes } from '../types/index.ts';
import { ObjectRef } from './object.ts';
export class SubscriptionRef<Types extends SchemaTypes> extends ObjectRef<Types, Types["Root"]> {
}
