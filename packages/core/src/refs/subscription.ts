import { SchemaTypes } from '../types';
import { ObjectRef } from './object';

export class SubscriptionRef<Types extends SchemaTypes> extends ObjectRef<Types, Types['Root']> {}
