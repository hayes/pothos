import SchemaBuilder from '@pothos/core';
import RelayPlugin from '../../../src';
import { Poll } from './data';
import { ContextType } from './types';

export default new SchemaBuilder<{
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
  };
  Context: ContextType;
  Connection: {
    totalCount: number;
  };
  DefaultEdgesNullability: false;
  DefaultNodeNullability: true;
}>({
  plugins: [RelayPlugin],
  relayOptions: {
    nodeQueryOptions: {
      resolve: (root, { id }, context, info) => Poll.map.get(Number(id)),
    },
    nodesQueryOptions: {
      resolve: (root, { ids }, context, info) =>
        ids.map(({ id, type }) => Poll.map.get(Number(id))),
    },
  },
});
