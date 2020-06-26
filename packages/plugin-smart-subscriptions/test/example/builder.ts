import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import { Poll } from './data';
import { subscribeOptionsFromIterator } from '../../src';

interface TypeInfo {
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
  };
  Context: ContextType;
  SmartSubscriptions: string;
}

export default new SchemaBuilder<TypeInfo>({
  plugins: ['GiraphQLSmartSubscriptions'],
  smartSubscriptions: {
    ...subscribeOptionsFromIterator((name, { pubsub }) => {
      return pubsub.asyncIterator(name);
    }),
  },
});
