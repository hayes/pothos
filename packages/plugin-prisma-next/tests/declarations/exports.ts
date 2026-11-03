// Each export's declaration must name only types the package exports from its entry.
import SchemaBuilder, { type FieldMap, type FieldRef } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import prismaNextPlugin, {
  type PrismaNextObjectRef,
  prismaConnectionHelpers,
} from 'plugin-under-test';
import type { Contract } from '../fixtures/sample-contract';

export const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});

export const UserWithPosts = builder.prismaInterface('User', {
  variant: 'UserWithPosts',
  select: { posts: true },
  fields: (t) => ({ postCount: t.int({ resolve: (user) => user.posts.length }) }),
});

export const UserWithPostTitles = builder.prismaInterface('User', {
  variant: 'UserWithPostTitles',
  select: { email: true, posts: (sub) => ({ postRows: sub.select('title') }) },
  fields: (t) => ({ postCount: t.int({ resolve: (user) => user.postRows.length }) }),
});

export const User = builder.prismaObject('User', {
  interfaces: [UserWithPosts],
  fields: (t) => ({ id: t.exposeID('id') }),
});

export const UserNode = builder.prismaNode('User', {
  variant: 'UserNode',
  id: { field: 'id' },
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

export const PostNode = builder.prismaNode('Post', {
  id: { field: 'id' },
  select: { author: true, comments: true },
  fields: (t) => ({ title: t.exposeString('title') }),
});

export const PostWithAuthor = builder.prismaObject('Post', {
  variant: 'PostWithAuthor',
  select: { author: true },
  fields: (t) => ({ authorName: t.string({ resolve: (post) => post.author.firstName }) }),
});

export const userPages = prismaConnectionHelpers(builder, 'User', {
  resolveNode: (user) => ({ user }),
});

export const commentPages = prismaConnectionHelpers(builder, 'Comment', {
  select: (nodeSelection) => ({ body: true, author: nodeSelection() }),
  resolveNode: (comment) => comment.author,
});

export const postPages = prismaConnectionHelpers(builder, 'Post', {
  select: () => ({ author: true }),
  resolveNode: (post) => ({ post, author: post.author }),
});

export const CompoundPostNode = builder.prismaNode('Post', {
  variant: 'CompoundPostNode',
  id: {
    field: ['authorId', 'id'],
    parse: (id) => id.split(':') as [string, string],
    resolve: (post) => `${post.authorId}:${post.id}`,
  },
  select: { author: true },
  fields: (t) => ({ title: t.exposeString('title') }),
});

export const PostCounts = builder.prismaObject('Post', {
  variant: 'PostCounts',
  select: { title: true, comments: (sub) => ({ commentCount: sub.count() }), views: true },
  fields: (t) => ({ commentCount: t.int({ resolve: (post) => post.commentCount }) }),
});

export const searchPages = prismaConnectionHelpers(builder, 'User', {
  args: (t) => ({ name: t.string() }),
  query: (args) => ({ where: args.name ? { firstName: args.name } : undefined }),
  select: () => ({ email: true, posts: true }),
  totalCount: true,
});

export const UserStats = builder.prismaObject('User', {
  variant: 'UserStats',
  select: {
    posts: (sub) => ({
      total: sub.count(),
      average: sub.avg('published'),
      publishedRows: sub.where({ published: 1 }),
    }),
  },
  fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
});

export const resolveUserPage = (
  rows: Parameters<typeof userPages.resolve>[0],
  ctx: object,
  parent: object,
) => userPages.resolve(rows, {}, ctx, parent);

export const paginateUsers = (collection: Parameters<typeof userPages.applyPagination>[0]) =>
  userPages.applyPagination(collection, {}, {});

export const userPageEntry = userPages.page;

// Helpers made from refs: `ref`, `page` and `resolve` carry the ref's type and its selection.
export const postWithAuthorPages = prismaConnectionHelpers(builder, PostWithAuthor, {
  select: () => ({ author: true }),
  resolveNode: (post) => ({ post, author: post.author }),
});

export const userNodePages = prismaConnectionHelpers(builder, UserNode, {});

export const userWithPostsPages = prismaConnectionHelpers(builder, UserWithPosts, {
  resolveNode: (user) => user,
});

// `prismaObjectField(s)` return void, so the fields are declared beside the call. `satisfies`
// types `t` from the method, so the declaration names its field builder and parent shape.
type Types = typeof builder.$inferSchemaTypes;
type ShapeOf<Ref> = Ref extends PrismaNextObjectRef<Types, 'Post', infer Shape> ? Shape : never;

export const postWithAuthorFields = ((t): FieldMap => ({
  authorEmail: t.string({ resolve: (post) => post.author.email }),
  author: t.relation('author'),
})) satisfies Parameters<
  typeof builder.prismaObjectFields<'Post', ShapeOf<typeof PostWithAuthor>>
>[1];

builder.prismaObjectFields(PostWithAuthor, postWithAuthorFields);

export const userPostCountField = ((t): FieldRef<Types, unknown> =>
  t.relationCount('posts')) satisfies Parameters<typeof builder.prismaObjectField<'User'>>[2];

builder.prismaObjectField('User', 'postCount', userPostCountField);
