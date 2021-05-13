import SchemaBuilder from '@giraphql/core';
import RelayPlugin from '@giraphql/plugin-relay';
import DataloaderPlugin from '../../src';
import { ContextType } from './types';

export default new SchemaBuilder<{ Context: ContextType }>({
  relayOptions: {
    pageInfoTypeOptions: {},
    nodeTypeOptions: {},
    nodeQueryOptions: {},
    nodesQueryOptions: {},
  },
  plugins: [RelayPlugin, DataloaderPlugin],
});
