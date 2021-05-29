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
}

export default new SchemaBuilder<UserSchemaTypes>({
  plugins: [RelayPlugin],
  relayOptions: {
    nodeQueryOptions: {
      description: 'node query',
    },
    nodesQueryOptions: {
      description: 'nodes query',
    },
    nodeTypeOptions: {
      description: 'node type',
    },
    pageInfoTypeOptions: {
      description: 'page info type',
    },
    clientMutationIdFieldOptions: {
      description: 'client id output',
    },
    clientMutationIdInputOptions: {
      description: 'client id input',
    },
    mutationInputArgOptions: {
      description: 'mutation input arg',
    },
  },
});
