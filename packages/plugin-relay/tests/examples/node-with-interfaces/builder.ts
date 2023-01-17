import SchemaBuilder from '@pothos/core';
import RelayPlugin from '../../../src';
import { Customer, User } from './types';

export default new SchemaBuilder<{
  Interfaces: {
    User: User;
  };
  Objects: {
    Customer: Customer;
  };
  DefaultNodeNullability: true;
}>({
  plugins: [RelayPlugin],
  relayOptions: {
    nodeQueryOptions: {
      description: 'node query',
    },
    nodesQueryOptions: {
      description: 'nodes query',
    },
  },
});
