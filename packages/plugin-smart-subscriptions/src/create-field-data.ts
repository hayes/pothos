import { GiraphQLOutputFieldConfig, SchemaTypes } from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';

import './global-types';
import SmartSubscriptionsPlugin, { FieldSubscriptionManager } from '.';

export function getFieldSubscribe<Types extends SchemaTypes>(
  field: GiraphQLOutputFieldConfig<Types>,
  plugin: SmartSubscriptionsPlugin<Types>,
) {
  if (
    field.graphqlKind === 'Object' &&
    field.kind !== 'Mutation' &&
    field.kind !== 'Subscription'
  ) {
    return field.giraphqlOptions.subscribe as (
      subscriptions: FieldSubscriptionManager,
      parent: unknown,
      args: {},
      context: object,
      info: GraphQLResolveInfo,
    ) => void;
  }

  if (field.kind === 'Subscription' && plugin.smartSubscriptionsToQueryField.has(field.name)) {
    return plugin.smartSubscriptionsToQueryField.get(field.name)!.subscribe as (
      subscriptions: FieldSubscriptionManager,
      parent: unknown,
      args: {},
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => void;
  }

  return null;
}
