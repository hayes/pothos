import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import SimpleObjectsPlugin from '../../../src';

type Types = {
  Context: ContextType;
  Scalars: {
    ID: {
      Input: string;
      Output: string | number;
    };
  };
};

export default new SchemaBuilder<Types>({
  plugins: [new SimpleObjectsPlugin()],
});
