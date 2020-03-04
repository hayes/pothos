import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import { Poll } from './data';
import SmartSubscriptionPlugin from '../../src';

interface TypeInfo {
  Object: {
    Poll: Poll;
    PollResult: {
      answer: string;
      count: number;
    };
  };
  Context: ContextType;
  SmartSubscriptions: string;
}

export default new SchemaBuilder<TypeInfo>({
  plugins: [
    new SmartSubscriptionPlugin<ContextType>({
      subscribe: (name, { pubsub }) => {
        return pubsub.asyncIterator(name);
      },
    }),
  ],
});
