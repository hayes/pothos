import { SchemaTypes } from '../types';
import RootFieldBuilder from './root';

export default class SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {
  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    super('Subscription', builder, 'Subscription', 'Object');
  }
}
