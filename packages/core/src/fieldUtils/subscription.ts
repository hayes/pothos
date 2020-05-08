import RootFieldBuilder from './root';
import { SchemaTypes } from '../types';

export default class SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape
> extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {
  constructor() {
    super('Subscription');
  }
}
