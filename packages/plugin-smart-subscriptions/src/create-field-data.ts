import './global-types.js';
import type { PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';
import type { PothosSmartSubscriptionsPlugin } from './index.js';
import type { FieldSubscriber } from './types.js';

export function getFieldSubscribe<Types extends SchemaTypes>(
  field: PothosOutputFieldConfig<Types>,
  plugin: PothosSmartSubscriptionsPlugin<Types>,
) {
  if (
    field.graphqlKind === 'Object' &&
    field.kind !== 'Mutation' &&
    field.kind !== 'Subscription'
  ) {
    return field.pothosOptions.subscribe as FieldSubscriber<Types>;
  }

  if (field.kind === 'Subscription' && plugin.smartSubscriptionsToQueryField.has(field.name)) {
    return plugin.smartSubscriptionsToQueryField.get(field.name)!
      .subscribe as FieldSubscriber<Types>;
  }

  return null;
}
