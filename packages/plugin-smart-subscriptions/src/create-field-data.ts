import './global-types';
import { GiraphQLOutputFieldConfig, SchemaTypes } from '@giraphql/core';
import { FieldSubscriber } from './types';
import SmartSubscriptionsPlugin from '.';

export function getFieldSubscribe<Types extends SchemaTypes>(
  field: GiraphQLOutputFieldConfig<Types>,
  plugin: SmartSubscriptionsPlugin<Types>,
) {
  if (
    field.graphqlKind === 'Object' &&
    field.kind !== 'Mutation' &&
    field.kind !== 'Subscription'
  ) {
    return field.giraphqlOptions.subscribe as FieldSubscriber<Types>;
  }

  if (field.kind === 'Subscription' && plugin.smartSubscriptionsToQueryField.has(field.name)) {
    return plugin.smartSubscriptionsToQueryField.get(field.name)!
      .subscribe as FieldSubscriber<Types>;
  }

  return null;
}
