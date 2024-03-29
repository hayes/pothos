import SchemaBuilder from '@pothos/core';
import RelayPlugin from '../../../src';
import { users } from './data';

export default new SchemaBuilder<{
  Objects: {
    User: { id: number; age: number };
  };
  DefaultNodeNullability: true;
}>({
  plugins: [RelayPlugin],
  relayOptions: {
    nodeQueryOptions: {
      resolve: (root, { id }, context, info) => users[Number.parseInt(String(id.id), 10)],
    },
    nodesQueryOptions: {
      resolve: (root, { ids }, context, info) =>
        ids.map(({ id }) => users[Number.parseInt(String(id), 10)]),
    },
  },
});
