// Step 2 — relations and includes.
//
// Each `t.relation` declared inside `user.ts` / `post.ts` / `comment.ts`
// compiles to an entry in the parent type's `select` map. When the
// `users` resolver returns its Collection, the plugin's walker reads
// the GraphQL selection set, descends through declared relations, and
// emits one `.include(...)` per nested level. The result is a single
// prisma-next query instead of N+1 round-trips.

import { builder } from './builder';
import { db } from './db';
// Side-effect imports — each model file registers its type with the
// shared builder. The order doesn't matter: prismaObject calls are
// schema-build-time only, and relation names cross-reference by string.
import './user';
import './post';
import './comment';

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: ['User'],
      resolve: () => db.orm.User,
    }),
  }),
});

export const schema = builder.toSchema();
