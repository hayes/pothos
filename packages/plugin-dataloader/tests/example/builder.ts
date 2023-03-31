import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import DataloaderPlugin from '../../src';
import { ContextType } from './types';

export default new SchemaBuilder<{ Context: ContextType }>({
  relay: {
    pageInfoTypeOptions: {},
    nodeTypeOptions: {},
    nodeQueryOptions: {},
    nodesQueryOptions: {},
  },
  plugins: [RelayPlugin, ErrorsPlugin, DataloaderPlugin],
  errors: {
    defaultTypes: [Error],
  },
});
