import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../example/db/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const client = createClient({
  url: `file:${resolve(__dirname, '../example/db/dev.db')}`,
});

// The tables the example fixture seeds, related in the two shapes the plugin has to build SQL for
// beyond a plain foreign key: a many-to-many `through` a junction table, and a relation carrying
// its own `where`.
export const relations = defineRelations(schema, (r) => ({
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    comments: r.many.comments({
      from: r.posts.postId,
      to: r.comments.postId,
    }),
    commenters: r.many.users({
      from: r.posts.postId.through(r.comments.postId),
      to: r.users.id.through(r.comments.authorId),
    }),
    // no `from`/`to`: drizzle reverses `users.publishedPosts`, which means this relation inherits
    // its `where`, and the inherited `where` reads off the source (posts) rather than the target
    publishedAuthor: r.one.users({ alias: 'publishedPosts' }),
  },
  users: {
    posts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
    }),
    publishedPosts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
      where: { published: 1 },
      alias: 'publishedPosts',
    }),
    comments: r.many.comments({
      from: r.users.id,
      to: r.comments.authorId,
    }),
  },
  comments: {
    author: r.one.users(),
    post: r.one.posts(),
  },
}));

export const db = drizzle({ client, relations });

export type DrizzleRelations = typeof relations;
