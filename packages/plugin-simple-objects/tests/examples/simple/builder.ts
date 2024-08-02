import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '../../../src';
import type { ContextType } from './types';

interface Types {
  Context: ContextType;
  Scalars: {
    ID: {
      Input: string;
      Output: number | string;
    };
  };
}

export default new SchemaBuilder<Types>({
  plugins: [SimpleObjectsPlugin],
});
