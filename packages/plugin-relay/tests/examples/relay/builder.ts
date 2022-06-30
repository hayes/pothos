import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import RelayPlugin from '../../../src';
import { Poll } from './data';
import { ContextType } from './types';

export default new SchemaBuilder<{
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
  };
  Context: ContextType;
}>({
  plugins: [RelayPlugin, ComplexityPlugin],
  relayOptions: {},
});
