import { SchemaTypes } from '../types/index.js';
import RootFieldBuilder from './root.js';

export default class SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {
  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super('Subscription', builder, 'Subscription', 'Object');
  }
}
