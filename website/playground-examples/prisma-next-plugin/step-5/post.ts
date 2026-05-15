import { builder } from './builder';
import { db } from './db';

// `builder.prismaNode` registers a GraphQL type that implements Relay's
// `Node` interface AND wires up the batched `node(id:)` loader the
// Relay plugin exposes. The plugin installs a loader that:
//   1. Batches concurrent `node(id:)` lookups at the same query path
//      into one `collection.where(idIn).all()` — DataLoader-shaped,
//      scoped per path.
//   2. Walks the GraphQL selection set on the resolved row and emits
//      auto-`.include(...)` calls (same machinery as `t.prismaField`).
//   3. Brands the resolved row so `resolveType` picks the right GraphQL
//      type when the row appears in an abstract position.
//
// `collection` is most often a `(ctx) => ctx.db.orm.Post` callback so
// the lookup runs against the per-request client; here the demo uses
// the module-level `db` because the playground's Context tab can't
// carry live clients.
builder.prismaNode('Post', {
  id: { field: 'id' },
  collection: () => db.orm.Post,
  select: ['id'],
  // Rows loaded through `node(id:)`'s batch loader are branded
  // automatically, but rows surfaced via `t.relatedConnection('posts')`
  // come from a parent include — those aren't branded, so the
  // default brand-only `isTypeOf` rejects them. A shape-based
  // predicate covers both code paths until the plugin lands
  // automatic branding for connection rows.
  isTypeOf: (row) => typeof (row as { id?: unknown }).id === 'string',
  fields: (t) => ({
    title: t.exposeString('title'),
    published: t.boolean({
      select: ['published'],
      resolve: (post) => Boolean(post.published),
    }),
    author: t.relation('author'),
  }),
});
