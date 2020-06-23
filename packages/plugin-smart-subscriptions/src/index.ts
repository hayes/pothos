import SchemaBuilder, { BasePlugin, SchemaTypes, GiraphQLOutputFieldConfig } from '@giraphql/core';
import './global-types';

import MergedAsyncIterator from './merged-iterator';
import SubscriptionManager from './manager';
import FieldSubscriptionManager from './manager/field';
import TypeSubscriptionManager from './manager/type';
import ResolverCache, { CacheForField } from './cache';
import BaseSubscriptionManager from './manager/base';
import SmartSubscriptionsFieldWrapper from './field-wrapper';

export {
  MergedAsyncIterator,
  SubscriptionManager,
  BaseSubscriptionManager,
  TypeSubscriptionManager,
  FieldSubscriptionManager,
  ResolverCache,
  CacheForField,
};

export * from './types';
export * from './utils';

export default class SmartSubscriptionsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  debounceDelay: number | null;

  smartSubscriptionsToQueryField = new Map<
    string,
    Extract<GiraphQLOutputFieldConfig<Types>, { kind: 'Query' }>
  >();

  subscribe: (
    name: string,
    context: Types['Context'],
    cb: (err: unknown, data: unknown) => void,
  ) => Promise<void> | void;

  unsubscribe: (name: string, context: Types['Context']) => Promise<void> | void;

  constructor(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    name: 'GiraphQLSmartSubscriptions',
  ) {
    super(builder, name);
    this.subscribe = builder.options.smartSubscriptions.subscribe;
    this.unsubscribe = builder.options.smartSubscriptions.unsubscribe;
    this.debounceDelay = builder.options.smartSubscriptions.debounceDelay ?? 10;
  }

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    if (fieldConfig.kind !== 'Query') {
      return;
    }

    if (fieldConfig.options.smartSubscription) {
      this.smartSubscriptionsToQueryField.set(fieldConfig.name, fieldConfig);

      this.builder.subscriptionField(fieldConfig.name, (t) =>
        t.field({
          ...fieldConfig.options,
          subscribe: (parent, args, context, info) => {
            const manager = new SubscriptionManager({
              value: parent,
              debounceDelay: this.debounceDelay,
              subscribe: (subName, cb) => this.subscribe(subName, context, cb),
              unsubscribe: (subName) => this.unsubscribe(subName, context),
            });

            return manager;
          },
        }),
      );
    }
  }

  wrapOutputField(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    return new SmartSubscriptionsFieldWrapper(fieldConfig, this);
  }
}

SchemaBuilder.registerPlugin('GiraphQLSmartSubscriptions', SmartSubscriptionsPlugin);
