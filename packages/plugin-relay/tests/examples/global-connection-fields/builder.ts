import SchemaBuilder from '@giraphql/core';
import RelayPlugin from '../../../src';
import { Poll } from './data';
import { ContextType } from './types';

interface UserSchemaTypes {
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
  };
  Context: ContextType;
  Connection: {
    totalCount: number;
  };
}

export default new SchemaBuilder<UserSchemaTypes>({
  plugins: [RelayPlugin],
  relayOptions: {
    nodeQueryOptions: {},
    nodesQueryOptions: {},
    nodeTypeOptions: {},
    pageInfoTypeOptions: {},
  },
});
