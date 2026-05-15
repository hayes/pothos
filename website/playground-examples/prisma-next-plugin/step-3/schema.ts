// Step 3 — per-field selections and computed/aggregate fields.
//
// Most resolvers reuse the parent row as-is, but some need extra
// columns (`fullName` needs `firstName` + `lastName`) or whole include
// trees with their own refinements (`postCount` needs an aggregate
// `count()` against the `posts` relation). The plugin offers a single
// `select` option that handles both — the walker collects every
// field's `select` declaration and folds them into one prisma-next
// Collection query.

import { builder } from './builder';
import { db } from './db';
import './user';
import './post';

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: ['User'],
      resolve: () => db.orm.User,
    }),
  }),
});

export const schema = builder.toSchema();
