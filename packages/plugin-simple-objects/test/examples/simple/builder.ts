import SchemaBuilder from '@giraphql/core';
import SimpleObjectsPlugin from '../../../src';
import { ContextType } from './types';

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
  plugins: [SimpleObjectsPlugin]
});
