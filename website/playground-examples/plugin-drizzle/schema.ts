import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import RelayPlugin from '@pothos/plugin-relay';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { db } from './database';
import { posts, relations } from './tables';

// #region builder
const builder = new SchemaBuilder<{
  DrizzleRelations: typeof relations;
  Context: { userId: number };
}>({
  relay: { nodesOnConnection: true },
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: db, relations, getTableConfig },
});
// #endregion builder

// #region user
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  select: {},
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    fullName: t.string({
      select: { columns: { firstName: true, lastName: true } },
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    bio: t.string({
      nullable: true,
      select: { with: { profile: true } },
      resolve: (user) => user.profile?.bio,
    }),
    posts: t.relation('posts', {
      args: { oldestFirst: t.arg.boolean() },
      query: (args) => ({
        where: { published: true },
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
          id: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
    postCount: t.relatedCount('posts', { where: eq(posts.published, true) }),
    postsConnection: t.relatedConnection('posts', {
      query: { where: { published: true }, orderBy: { createdAt: 'desc' } },
      totalCount: true,
    }),
  }),
});
// #endregion user

// #region post
builder.drizzleObject('posts', {
  name: 'Post',
  select: {},
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
    media: t.relation('media'),
    mediaConnection: t.relatedConnection('media', {
      query: { orderBy: { id: 'asc' } },
      totalCount: true,
    }),
  }),
});
builder.drizzleObject('media', {
  name: 'Media',
  fields: (t) => ({ url: t.exposeString('url'), uploadedBy: t.relation('uploadedBy') }),
});
// #endregion post

// #region viewer
const Viewer = builder.drizzleInterface('users', {
  variant: 'Viewer',
  select: { columns: { id: true, role: true } },
  resolveType: (user) => (user.role === 'editor' ? 'EditorViewer' : 'AuthorViewer'),
  fields: (t) => ({
    user: t.variant('users'),
    email: t.exposeString('email'),
    drafts: t.relation('posts', {
      query: { where: { published: false }, orderBy: { id: 'asc' } },
    }),
  }),
});
builder.drizzleObject('users', {
  variant: 'EditorViewer',
  interfaces: [Viewer],
  select: { columns: { id: true, role: true } },
  fields: (t) => ({ canReviewSubmissions: t.boolean({ resolve: () => true }) }),
});
builder.drizzleObject('users', {
  variant: 'AuthorViewer',
  interfaces: [Viewer],
  select: { columns: { id: true, role: true } },
});
// #endregion viewer

// #region author-query
builder.queryType({});
builder.queryField('author', (t) =>
  t.drizzleField({
    type: 'users',
    nullable: true,
    args: { id: t.arg.int({ required: true }) },
    resolve: (query, _root, args) => db.query.users.findFirst(query({ where: { id: args.id } })),
  }),
);
// #endregion author-query

// #region queries
builder.queryFields((t) => ({
  me: t.drizzleField({
    type: Viewer,
    nullable: true,
    resolve: (query, _root, _args, ctx) =>
      db.query.users.findFirst(query({ where: { id: ctx.userId } })),
  }),
  posts: t.drizzleConnection({
    type: 'posts',
    resolve: (query) =>
      db.query.posts.findMany(
        query({
          where: { published: true },
          // Three posts share this timestamp. Pothos adds the primary key
          // to the cursor ordering, so traversing pages still visits each once.
          orderBy: { createdAt: 'desc' },
        }),
      ),
  }),
}));
// #endregion queries

export const schema = builder.toSchema();
