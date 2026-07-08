import type { SchemaTypes } from '../types/index.js';
import { RootFieldBuilder } from './root.js';

export class SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'Subscription', 'Object');
  }
}
