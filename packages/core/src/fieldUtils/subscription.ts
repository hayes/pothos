import RootFieldBuilder from './root';

export default class SubscriptionFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape
> extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {
  constructor() {
    super('Subscription');
  }
}
