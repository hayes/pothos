// Each export's declaration must name only types the package exports from its entry.
import SchemaBuilder, { type FieldMap, type FieldRef } from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import type { GraphQLResolveInfo } from 'graphql';
import PrismaPlugin, {
  getModel,
  getRefFromModel,
  type PothosPrismaDatamodel,
  type PrismaTypesFromClient,
  prismaConnectionHelpers,
  // biome-ignore lint/correctness/noUnusedImports: `emailField`'s declaration names it
  prismaModelName,
  queryFromInfo,
} from 'plugin-under-test';
import type { PrismaClient } from '../client/client.js';

declare const prisma: PrismaClient;
declare const datamodel: PothosPrismaDatamodel;

export const builder = new SchemaBuilder<{
  Context: { userId: number };
  PrismaTypes: PrismaTypesFromClient<PrismaClient>;
}>({
  plugins: [ErrorsPlugin, RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: prisma, dmmf: datamodel },
});

type Types = typeof builder.$inferSchemaTypes;

export const Named = builder.prismaInterface('User', {
  name: 'Named',
  fields: (t) => ({ name: t.exposeString('name', { nullable: true }) }),
});

export const UserWithPosts = builder.prismaInterface('User', {
  variant: 'UserWithPosts',
  select: { posts: true },
  fields: (t) => ({ postCount: t.int({ resolve: (user) => user.posts.length }) }),
});

export const User = builder.prismaObject('User', {
  interfaces: [Named],
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.relation('posts'),
    postCount: t.relationCount('posts'),
  }),
});

export const UserNode = builder.prismaNode('User', {
  variant: 'UserNode',
  id: { field: 'id' },
  fields: (t) => ({ email: t.exposeString('email') }),
});

export const Post = builder.prismaNode('Post', {
  id: { field: 'id' },
  include: { author: true },
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
    comments: t.relatedConnection('comments', { cursor: 'id', totalCount: true }),
  }),
});

export const PostWithAuthor = builder.prismaObject('Post', {
  variant: 'PostWithAuthor',
  select: { id: true, author: true },
  fields: (t) => ({ authorEmail: t.string({ resolve: (post) => post.author.email }) }),
});

export const PostSummary = builder.prismaObject('Post', {
  variant: 'PostSummary',
  select: {
    title: true,
    author: { select: { email: true } },
    _count: { select: { comments: true } },
  },
  fields: (t) => ({
    title: t.exposeString('title'),
    authorEmail: t.string({ resolve: (post) => post.author.email }),
    commentCount: t.int({ resolve: (post) => post._count.comments }),
  }),
});

export const Comment = builder.prismaObject('Comment', {
  fields: (t) => ({ content: t.exposeString('content'), author: t.relation('author') }),
});

export const Follow = builder.prismaNode('Follow', {
  id: { field: 'compositeID' },
  fields: (t) => ({ from: t.relation('from') }),
});

export const commentPages = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  select: (nodeSelection) => ({ author: nodeSelection() }),
  resolveNode: (comment) => comment.author,
});

export const postPages = prismaConnectionHelpers(builder, PostWithAuthor, {
  cursor: 'id',
  args: (t) => ({ published: t.boolean() }),
  query: (args) => ({ where: { published: args.published ?? undefined } }),
});

export const userNodePages = prismaConnectionHelpers(builder, UserNode, { cursor: 'email' });

export const userWithPostsPages = prismaConnectionHelpers(builder, UserWithPosts, {
  cursor: 'id',
  resolveNode: (user) => user,
});

export const resolveCommentPage = (
  rows: Parameters<typeof commentPages.resolve>[0],
  args: Parameters<typeof commentPages.resolve>[1],
  ctx: Types['Context'],
) => commentPages.resolve(rows, args, ctx);

export const commentPageQuery = (
  args: Parameters<typeof commentPages.getQuery>[0],
  ctx: Types['Context'],
  nested: Parameters<typeof commentPages.getQuery>[2],
) => commentPages.getQuery(args, ctx, nested);

// `prismaObjectField(s)` return void, so the fields are declared beside the call. `satisfies`
// types `t` from the method, so the declaration names its field builder and parent shape. The
// `FieldRef` return annotations stand in for @pothos/core's own `FieldRef`, which emitted
// declarations can't name (TS2742/TS2883 from @pothos/core alone).
type UserFieldBuilder = Parameters<Parameters<typeof builder.prismaObjectField<'User'>>[2]>[0];

export const postsConnectionField = (t: UserFieldBuilder) =>
  t.relatedConnection('posts', { cursor: 'id' });

builder.prismaObjectField('User', 'postsConnection', postsConnectionField);

export const profileField = (t: UserFieldBuilder) => t.relation('profile', { nullable: true });

builder.prismaObjectField(User, 'profile', profileField);

export const nodeVariantField = (t: UserFieldBuilder) => t.variant(UserNode);

builder.prismaObjectField(User, 'node', nodeVariantField);

// Without a written parameter type the declaration spells out the parent shape, whose model-name
// key is the `prismaModelName` symbol: declaration emit can only name it when the file imports it.
export const emailField = ((t): FieldRef<Types, unknown> =>
  t.exposeString('email')) satisfies Parameters<typeof builder.prismaObjectField<'User'>>[2];

builder.prismaObjectField('User', 'emailAgain', emailField);

export const postWithAuthorFields = (
  t: Parameters<Parameters<typeof builder.prismaObjectFields<typeof PostWithAuthor>>[1]>[0],
): FieldMap => ({
  authorId: t.string({ resolve: (post) => String(post.author.id) }),
});

builder.prismaObjectFields(PostWithAuthor, postWithAuthorFields);

export const namedFields = (
  t: Parameters<Parameters<typeof builder.prismaInterfaceFields<typeof Named>>[1]>[0],
): FieldMap => ({ email: t.exposeString('email') });

builder.prismaInterfaceFields(Named, namedFields);

type QueryFieldBuilder = PothosSchemaTypes.QueryFieldBuilder<Types, Types['Root']>;

export const userField = (t: QueryFieldBuilder) =>
  t.prismaField({
    type: 'User',
    nullable: true,
    resolve: (query, _root, _args, ctx) =>
      prisma.user.findUnique({ ...query, where: { id: ctx.userId } }),
  });

export const usersConnectionField = (t: QueryFieldBuilder) =>
  t.prismaConnection({
    type: User,
    cursor: 'id',
    resolve: (query) => prisma.user.findMany({ ...query }),
  });

export const followsConnectionField = (t: QueryFieldBuilder) =>
  t.prismaConnection(
    {
      type: 'Follow',
      cursor: 'compositeID',
      resolve: (query) => prisma.follow.findMany({ ...query }),
    },
    { name: 'FollowPages' },
  );

builder.queryFields((t) => ({
  user: userField(t),
  users: usersConnectionField(t),
  follows: followsConnectionField(t),
}));

export const userRef = getRefFromModel('User', builder);

export const userModel = getModel('User', builder);

export const userQuery = (context: object, info: GraphQLResolveInfo) =>
  queryFromInfo({ context, info, select: { id: true } });

export const brandUsers = (rows: Parameters<typeof User.addBrand>[0]) => User.addBrand(rows);

export const schema = builder.toSchema();

export const postCommentsField = (t: UserFieldBuilder): FieldRef<Types, unknown> =>
  t.field({
    type: [Comment],
    select: (_args, _ctx, nestedSelection) => ({
      comments: nestedSelection({ take: 3 }),
    }),
    resolve: (user) => user.comments,
  });

builder.prismaObjectField(User, 'recentComments', postCommentsField);

export const userFieldsData = datamodel.datamodel.models.User.fields;
