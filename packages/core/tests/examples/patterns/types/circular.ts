import builder from '../builder';
// eslint-disable-next-line import/no-cycle
import { B } from './circular-b';

export const A = builder.objectRef<{}>('A');

A.implement({
  fields: (t) => ({
    b: t.field({
      type: B,
      resolve: () => ({}),
    }),
  }),
});

const query = builder.queryType({
  fields: (t) => ({
    circular: t.field({
      type: A,
      resolve: () => ({}),
    }),
    query: t.field({
      type: query,
      resolve: () => ({}),
    }),
  }),
});
