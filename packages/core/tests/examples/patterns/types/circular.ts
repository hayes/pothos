import builder from '../builder';
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

builder.queryType({
  fields: (t) => ({
    circular: t.field({
      type: A,
      resolve: () => ({}),
    }),
  }),
});
