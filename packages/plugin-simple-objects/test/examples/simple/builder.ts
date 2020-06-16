import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import SimpleObjectsPlugin from '../../../src';

type Types = {
  Context: ContextType;
};

export default new SchemaBuilder<Types>({
  plugins: [new SimpleObjectsPlugin()],
});
