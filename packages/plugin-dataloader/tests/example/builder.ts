import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import DataloaderPlugin from '../../src';
import { ContextType } from './types';

export default new SchemaBuilder<{ Context: ContextType }>({
  relayOptions: {
    pageInfoTypeOptions: {},
    nodeTypeOptions: {},
    nodeQueryOptions: {},
    nodesQueryOptions: {},
  },
  plugins: [ErrorsPlugin, DataloaderPlugin, RelayPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});
