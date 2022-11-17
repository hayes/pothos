import SchemaBuilder from '@pothos/core';
import RelayPlugin, { decodeGlobalID } from '../../../src';
import { Poll } from './data';
import { ContextType } from './types';

function node(globalID: string) {
  const { id } = decodeGlobalID(globalID);
  return Poll.map.get(Number(id));
}

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
    nodesOnConnection: true,
    idFieldName: 'nodeId',
    nodeFieldOptions: {
      nullable: true,
    },
    edgesFieldOptions: {
      nullable: false,
    },
    clientMutationId: 'omit',
    cursorType: 'String',
    nodeQueryOptions: {
      description: 'node query',
      resolve: (globalID, context) => node(globalID) as any,
    },
    nodesQueryOptions: {
      description: 'nodes query',
      resolve: (globalIDs, context) => globalIDs.map((globalID) => node(globalID)) as any[],
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
