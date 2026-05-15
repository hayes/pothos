// Step 5 — Relay nodes + cursor pagination.
//
// `prismaNode` lifts a contract-backed type to a Relay `Node`,
// auto-wiring the global-ID encode / decode and the batched `node(id:)`
// loader. `t.relatedConnection` lays cursor pagination over a to-many
// relation without a separate prisma-next query — the pagination
// predicate rides inside the parent's include callback.
//
// Five queries to walk through, in order:
//   1. node-lookup       — batched `node(id:)` for two posts at once.
//   2. connection        — first page with `first:`, single-column cursor.
//   3. last-page         — backward pagination via `last:`.
//   4. totalCount        — `totalCount: true` runs a parallel `count(*)`.
//   5. compound-cursor   — lexicographic cursor on `[createdAt, id]`.

import { builder } from './builder';
import { db } from './db';
import './user';
import './post';

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, args) => db.orm.User.where((u) => u.id.eq(String(args.id))),
    }),
  }),
});

export const schema = builder.toSchema();
