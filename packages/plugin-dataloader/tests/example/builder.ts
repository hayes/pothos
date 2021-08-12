import SchemaBuilder from '@giraphql/core';
import ErrorsPlugin from '@giraphql/plugin-errors';
import RelayPlugin from '@giraphql/plugin-relay';
import DataloaderPlugin from '../../src/index.js';
import { ContextType } from './types';

export default new SchemaBuilder<{ Context: ContextType }>({
  relayOptions: {
    pageInfoTypeOptions: {},
    nodeTypeOptions: {},
    nodeQueryOptions: {},
    nodesQueryOptions: {},
  },
  plugins: [RelayPlugin, ErrorsPlugin, DataloaderPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});
