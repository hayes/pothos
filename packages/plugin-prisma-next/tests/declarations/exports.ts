// Each export's declaration must name only types the package exports from its entry.
import SchemaBuilder, { type FieldMap, type FieldRef } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import PrismaNextPlugin, {
  type NestedSelectionFn,
  type PrismaNextObjectRef,
  prismaConnectionHelpers,
} from 'plugin-under-test';
import type { Contract } from '../fixtures/sample-contract';

export const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
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
  select: { email: true, postRows: { posts: (sub) => sub.select('title') } },
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
  select: { title: true, commentCount: { comments: (sub) => sub.count() }, views: true },
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
    total: { posts: (sub) => sub.count() },
    average: { posts: (sub) => sub.avg('published') },
    publishedRows: { posts: (sub) => sub.where({ published: 1 }) },
  },
  fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
});

export const resolveUserPage = (rows: Parameters<typeof userPages.resolve>[0], ctx: object) =>
  userPages.resolve(rows, {}, ctx);

export const userPageEntry = (args: object, ctx: object) =>
  userPages.getQuery(args, ctx, () => null);

// Helpers made from refs: `ref`, `getQuery` and `resolve` carry the ref's type and its selection.
export const postWithAuthorPages = prismaConnectionHelpers(builder, PostWithAuthor, {
  select: () => ({ author: true }),
  resolveNode: (post) => ({ post, author: post.author }),
});

export const userNodePages = prismaConnectionHelpers(builder, UserNode, {});

export const userWithPostsPages = prismaConnectionHelpers(builder, UserWithPosts, {
  resolveNode: (user) => user,
});

// `prismaObjectField(s)` return void, so the fields are declared beside the call. `satisfies`
// types `t` from the method, so the declaration names its field builder and parent shape. The
// `FieldMap` and `FieldRef` return annotations stand in for @pothos/core's own `FieldRef`, which
// emitted declarations can't name (TS2742/TS2883 from @pothos/core alone).
type Types = typeof builder.$inferSchemaTypes;

// The methods' parameters for a ref argument, with the model and shape inferred from the ref.
type ObjectFieldsParams<Ref> =
  Ref extends PrismaNextObjectRef<Types, infer M, infer Shape>
    ? Parameters<typeof builder.prismaObjectFields<M, Shape>>
    : never;
type ObjectFieldParams<Ref> =
  Ref extends PrismaNextObjectRef<Types, infer M, infer Shape>
    ? Parameters<typeof builder.prismaObjectField<M, Shape>>
    : never;

export const postWithAuthorFields = ((t): FieldMap => ({
  authorEmail: t.string({ resolve: (post) => post.author.email }),
  author: t.relation('author'),
})) satisfies ObjectFieldsParams<typeof PostWithAuthor>[1];

builder.prismaObjectFields(PostWithAuthor, postWithAuthorFields);

export const postWithAuthorLastNameField = ((t): FieldRef<Types, unknown> =>
  t.string({ resolve: (post) => post.author.lastName })) satisfies ObjectFieldParams<
  typeof PostWithAuthor
>[2];

builder.prismaObjectField(PostWithAuthor, 'authorLastName', postWithAuthorLastNameField);

export const userNodeEmailField = ((t): FieldRef<Types, unknown> =>
  t.exposeString('email')) satisfies ObjectFieldParams<typeof UserNode>[2];

builder.prismaObjectField(UserNode, 'email', userNodeEmailField);

export const userPostCountField = ((t): FieldRef<Types, unknown> =>
  t.relationCount('posts')) satisfies Parameters<typeof builder.prismaObjectField<'User'>>[2];

builder.prismaObjectField('User', 'postCount', userPostCountField);

export const UserOrPost = builder.unionType('UserOrPost', { types: [User, PostWithAuthor] });

// Names the planned-row type a field returning a User resolves to.
export const brandUserRows = (rows: Parameters<typeof User.addBrand>[0]) => User.addBrand(rows);

// A field factory shared between types of a model: its declaration names the field builder and
// the relation's planned rows.
type UserFieldBuilder = Parameters<ObjectFieldParams<typeof User>[2]>[0];

export const postsField = (t: UserFieldBuilder) => t.relation('posts');

builder.prismaObjectField(User, 'posts', postsField);

// A select function shared between fields: its declaration names `nestedSelection` and its entry.
export const nestedPostsSelect = (
  _args: object,
  _ctx: object,
  nestedSelection: NestedSelectionFn<Types, 'Post', object>,
) => ({ posts: nestedSelection() });

builder.prismaObjectField(User, 'nestedPosts', (t) =>
  t.field({ type: [PostWithAuthor], select: nestedPostsSelect, resolve: (user) => user.posts }),
);
