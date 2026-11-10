// Each export's declaration must name only types the package exports from its entry.
import SchemaBuilder, { type FieldMap, type FieldRef } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { GraphQLResolveInfo } from 'graphql';
import DrizzlePlugin, {
  type DrizzleObjectRef,
  drizzleConnectionHelpers,
  getSchemaConfig,
  type NestedSelectionFn,
  queryFromInfo,
} from 'plugin-under-test';
import { relations } from '../example/db/relations';

export const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
  plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],
  drizzle: {
    client: () => null as never,
    getTableConfig,
    relations,
  },
});

export const UserWithPosts = builder.drizzleInterface('users', {
  variant: 'UserWithPosts',
  select: { with: { posts: true } },
  fields: (t) => ({ postCount: t.int({ resolve: (user) => user.posts.length }) }),
});

export const User = builder.drizzleObject('users', {
  interfaces: [UserWithPosts],
  select: { with: { posts: true } },
  fields: (t) => ({ id: t.exposeID('id'), username: t.exposeString('username') }),
});

export const UserNode = builder.drizzleNode('users', {
  variant: 'UserNode',
  id: { column: (user) => user.id },
  fields: (t) => ({ firstName: t.exposeString('firstName', { nullable: true }) }),
});

export const PostNode = builder.drizzleNode('posts', {
  id: { column: (post) => post.postId },
  select: { with: { author: true, comments: true } },
  fields: (t) => ({ title: t.exposeString('title') }),
});

export const LikeNode = builder.drizzleNode('postLikes', {
  id: { column: (like) => [like.postId, like.userId] },
  fields: (t) => ({ postId: t.exposeInt('postId') }),
});

export const PostWithAuthor = builder.drizzleObject('posts', {
  variant: 'PostWithAuthor',
  select: { with: { author: true } },
  fields: (t) => ({ authorName: t.string({ resolve: (post) => post.author?.username }) }),
});

export const PostTitle = builder.drizzleObject('posts', {
  variant: 'PostTitle',
  select: { columns: { title: true } },
  fields: (t) => ({ title: t.exposeString('title') }),
});

export const Comment = builder.drizzleObject('comments', {
  fields: (t) => ({
    text: t.exposeString('text'),
    author: t.relation('author'),
    post: t.relation('post', { type: PostWithAuthor }),
  }),
});

export const userPages = drizzleConnectionHelpers(builder, 'users', {});

export const commentPages = drizzleConnectionHelpers(builder, 'comments', {
  select: (nodeSelection) => ({ with: { author: nodeSelection() } }),
  resolveNode: (comment) => comment.author,
});

export const searchPages = drizzleConnectionHelpers(builder, 'users', {
  args: (t) => ({ name: t.string() }),
  query: (args: { name?: string | null }) => ({
    where: args.name ? { username: args.name } : undefined,
  }),
  select: () => ({ with: { posts: true } }),
});

// Helpers made from refs carry the ref's table and shape.
export const postWithAuthorPages = drizzleConnectionHelpers(builder, PostWithAuthor, {
  select: () => ({ with: { author: true } }),
  resolveNode: (post) => post,
});

export const userNodePages = drizzleConnectionHelpers(builder, UserNode, {});

export const userWithPostsPages = drizzleConnectionHelpers(builder, UserWithPosts, {});

export const { getQuery, resolve: resolveSearchPage, getArgs } = searchPages;

export const resolveUserPage = (rows: Parameters<typeof userPages.resolve>[0], ctx: object) =>
  userPages.resolve(rows, {}, ctx);

export const userPageQuery = (args: object, ctx: object, info: GraphQLResolveInfo) =>
  userPages.getQuery(args, ctx, info);

type Types = typeof builder.$inferSchemaTypes;

// `drizzleObjectField(s)` return void, so the fields are declared beside the call. `satisfies`
// types `t` from the method, so the declaration names its field builder and parent shape.
type ObjectFieldsParams<Ref extends DrizzleObjectRef<Types>> = Parameters<
  typeof builder.drizzleObjectFields<Ref>
>;
type ObjectFieldParams<Ref extends DrizzleObjectRef<Types>> = Parameters<
  typeof builder.drizzleObjectField<Ref>
>;

export const postWithAuthorFields = ((t): FieldMap => ({
  authorId: t.string({ nullable: true, resolve: (post) => post.author?.username }),
  author: t.relation('author'),
})) satisfies ObjectFieldsParams<typeof PostWithAuthor>[1];

builder.drizzleObjectFields(PostWithAuthor, postWithAuthorFields);

export const userNodeLastNameField = ((t): FieldRef<Types, unknown> =>
  t.exposeString('lastName', { nullable: true })) satisfies ObjectFieldParams<typeof UserNode>[2];

builder.drizzleObjectField(UserNode, 'lastName', userNodeLastNameField);

export const userPostCountField = ((t): FieldRef<Types, unknown> =>
  t.relatedCount('posts')) satisfies Parameters<typeof builder.drizzleObjectField<'users'>>[2];

builder.drizzleObjectField('users', 'postCount', userPostCountField);

export const UserOrPost = builder.unionType('UserOrPost', { types: [User, PostWithAuthor] });

export const brandUsers = (rows: Parameters<typeof User.addBrand>[0]) => User.addBrand(rows);

// Field factories shared between types of a table: their declarations name the field builder.
type UserFieldBuilder = Parameters<ObjectFieldParams<typeof User>[2]>[0];

export const postsField = (t: UserFieldBuilder) => t.relation('posts');
export const postPagesField = (t: UserFieldBuilder) => t.relatedConnection('posts');
export const nodeVariantField = (t: UserFieldBuilder) => t.variant(UserNode);
export const usernameField = (t: UserFieldBuilder) => t.exposeString('username');
export const withPostsField = (t: UserFieldBuilder) =>
  t.relatedField('posts', {
    type: 'Int',
    select: (buildFilter) => ({ extras: { postCount: (user) => buildFilter(user) } }),
    resolve: (user) => Number(user.postCount),
  });

builder.drizzleObjectFields(User, (t) => ({
  posts: postsField(t),
  postPages: postPagesField(t),
  node: nodeVariantField(t),
  withPosts: withPostsField(t),
}));

// A select function shared between fields: its declaration names `nestedSelection`.
export const nestedPostsSelect = (
  _args: object,
  _ctx: object,
  nestedSelection: NestedSelectionFn<Types, [typeof PostWithAuthor]>,
) => ({ with: { posts: nestedSelection() } });

// Query field factories: their declarations name the root field builder's drizzle methods.
type QueryFieldBuilder = PothosSchemaTypes.QueryFieldBuilder<Types, {}>;

export const usersField = (t: QueryFieldBuilder) =>
  t.drizzleField({
    type: [User],
    resolve: () => [],
  });

export const userConnectionField = (t: QueryFieldBuilder) =>
  t.drizzleConnection({ type: 'users', resolve: () => [] });

export const postConnectionField = (t: QueryFieldBuilder) =>
  t.drizzleConnection({ type: PostWithAuthor, resolve: () => [] });

export const createUserField = (t: QueryFieldBuilder) =>
  t.drizzleFieldWithInput({
    type: User,
    nullable: true,
    input: { name: t.input.string({ required: true }) },
    resolve: () => null,
  });

export const userQueryFromInfo = (
  t: QueryFieldBuilder,
  context: object,
  info: GraphQLResolveInfo,
) => t.drizzleQueryFromInfo('users', { context, info, with: { posts: true } });

export const userQuery = (context: object, info: GraphQLResolveInfo) =>
  queryFromInfo({ config: getSchemaConfig(builder), context, info, with: { posts: true } });

export const schemaConfig = getSchemaConfig(builder);
