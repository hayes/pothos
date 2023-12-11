import builder from '../builder';
// eslint-disable-next-line import/no-cycle
import { A } from './circular';

export const B = builder.objectRef<{}>('B');

B.implement({
  fields: (t) => ({
    a: t.field({
      type: A,
      resolve: () => ({}),
    }),
  }),
});
