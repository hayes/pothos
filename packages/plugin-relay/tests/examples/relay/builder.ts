import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import RelayPlugin from '../../../src';
import type { Poll } from './data';
import type { ContextType } from './types';

export default new SchemaBuilder<{
  Objects: {
    Poll: Poll;
    Answer: { id: number; value: string; count: number };
  };
  Context: ContextType;
  Defaults: 'v3';
}>({
  defaults: 'v3',
  plugins: [RelayPlugin, ComplexityPlugin],
  relayOptions: {},
});
