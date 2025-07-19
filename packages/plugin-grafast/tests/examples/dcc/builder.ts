import SchemaBuilder from '@pothos/core';
import GrafastPlugin from '../../../src';
import type { Database } from './data';

declare global {
  namespace Grafast {
    interface Context {
      dccDb: Database;
    }
  }
}

type BuilderTypes = {
  InferredFieldOptionsKind: 'Grafast';
  Scalars: {};
  Context: {
    dccDb: Database;
  };
};
export const builder = new SchemaBuilder<BuilderTypes>({
  plugins: [GrafastPlugin],
});
