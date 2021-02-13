import '../../../src';
import SchemaBuilder from '@giraphql/core';
import { Poll } from './data';
import { ContextType } from './types';

interface TypeInfo {
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
  };
  Context: ContextType;
}

export default new SchemaBuilder<TypeInfo>({
  plugins: ['GiraphQLRelay'],
  relayOptions: {
    nodeQueryOptions: {},
    nodesQueryOptions: {},
    nodeTypeOptions: {},
    pageInfoTypeOptions: {},
  },
});
