import SchemaBuilder from '@pothos/core';
import GrafastPlugin from '../../src';

export const builder = new SchemaBuilder<{
  InferredFieldOptionsKind: 'Grafast';
  Scalars: {};
  Context: {
    currentUserId: string;
  };
}>({
  plugins: [GrafastPlugin],
});
