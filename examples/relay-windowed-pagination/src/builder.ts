import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { PageCursors } from './types.ts';

export const builder = new SchemaBuilder<{
  Connection: {
    pageCursors: PageCursors;
  };
}>({
  plugins: [RelayPlugin],
  relay: {},
});
