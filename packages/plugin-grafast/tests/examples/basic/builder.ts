import SchemaBuilder from '@pothos/core';
import GrafastPlugin from '../../../src';

type BuilderTypes = {
  InferredFieldOptionsKind: 'Grafast';
  Scalars: {};
  Context: {
    currentUserId: string;
  };
};

export const builder = new SchemaBuilder<BuilderTypes>({
  plugins: [GrafastPlugin],
});
