import { GiraphQLOutputFieldConfig, SchemaTypes } from '@giraphql/core';

import './global-types';
import SmartSubscriptionsPlugin from '.';
import { FieldSubscriber } from './types';

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
