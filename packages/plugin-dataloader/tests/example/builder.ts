import SchemaBuilder from '@giraphql/core';
import DataloaderPlugin from '../../src';
import { ContextType } from './types';

export default new SchemaBuilder<{ Context: ContextType }>({
  plugins: [DataloaderPlugin],
});
