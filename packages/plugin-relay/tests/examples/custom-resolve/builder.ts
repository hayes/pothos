import SchemaBuilder from '@pothos/core';
import RelayPlugin from '../../../src';
import { users } from './data';

export default new SchemaBuilder<{
  Defaults: 'v3';
  Objects: {
    User: { id: number; age: number };
  };
  DefaultNodeNullability: true;
}>({
  plugins: [RelayPlugin],
  defaults: 'v3',
  relayOptions: {
    nodeQueryOptions: {
      resolve: (_root, { id }) => users[Number.parseInt(String(id.id), 10)],
    },
    nodesQueryOptions: {
      resolve: (_root, { ids }) => ids.map(({ id }) => users[Number.parseInt(String(id), 10)]),
    },
  },
});
