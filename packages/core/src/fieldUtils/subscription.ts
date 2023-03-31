import { SchemaTypes } from '../types';
import { RootFieldBuilder } from './root';

export class SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'Subscription', 'Object');
  }
}
