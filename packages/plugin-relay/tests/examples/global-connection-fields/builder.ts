import SchemaBuilder from '@pothos/core';
import RelayPlugin from '../../../src';
import type { Poll } from './data';
import type { ContextType } from './types';

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
  relay: {
    nodesOnConnection: true,
    idFieldName: 'nodeId',
    relayMutationFieldOptions: {
      nullable: false,
    },
    nodeFieldOptions: {
      nullable: true,
    },
    edgesFieldOptions: {
      nullable: false,
    },
    clientMutationId: 'omit',
    cursorType: 'String',
    nodeQueryOptions: false,
    nodesQueryOptions: false,
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
