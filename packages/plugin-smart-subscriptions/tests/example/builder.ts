import SchemaBuilder from '@giraphql/core';
import SmartSubscriptionsPlugin, { subscribeOptionsFromIterator } from '../../src/index.js';
import { Poll } from './data';
import { ContextType } from './types';

interface UserSchemaTypes {
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
    RefetchableAnswer: { id: number; value: string; count: number };
  };
  Context: ContextType;
  SmartSubscriptions: string;
}

export default new SchemaBuilder<UserSchemaTypes>({
  plugins: [SmartSubscriptionsPlugin],
  smartSubscriptions: {
    ...subscribeOptionsFromIterator((name, { pubsub }) => pubsub.asyncIterator(name)),
  },
});
