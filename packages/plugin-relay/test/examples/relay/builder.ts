import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import { Poll } from './data';
import RelayPlugin from '../../../src';

interface TypeInfo {
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
  };
  Context: ContextType;
}

export default new SchemaBuilder<TypeInfo>({
  plugins: [new RelayPlugin()],
});
