import { queryFromInfo } from '@pothos/plugin-prisma';
import { createSchemaBuilder } from './builder';
import { addMediaConnection, createMediaType } from './connections';
import type { Post as PostRow, PrismaClient } from './generated/client/client';

export function createSchema(prisma: PrismaClient) {
  const builder = createSchemaBuilder(prisma);

  // #region user
  builder.prismaNode('User', {
    id: { field: 'id' },
    select: { id: true },
    fields: (t) => ({
      name: t.exposeString('name'),
      bio: t.string({
        nullable: true,
        select: { profile: { select: { bio: true } } },
        resolve: (user) => user.profile?.bio,
      }),
      posts: t.relation('posts', {
        args: { oldestFirst: t.arg.boolean() },
        query: (args) => ({
          where: { published: true },
          orderBy: [
            { createdAt: args.oldestFirst ? 'asc' : 'desc' },
            { id: args.oldestFirst ? 'asc' : 'desc' },
          ],
        }),
      }),
      postCount: t.relationCount('posts', { where: { published: true } }),
      postsConnection: t.relatedConnection('posts', {
        cursor: 'id',
        query: { where: { published: true }, orderBy: { id: 'asc' } },
        totalCount: true,
      }),
    }),
  });
  // #endregion user

  const Media = createMediaType(builder);
  builder.prismaObject('Comment', {
    fields: (t) => ({ content: t.exposeString('content'), author: t.relation('author') }),
  });

  // #region post
  const Post = builder.prismaNode('Post', {
    nullable: true,
    id: { field: 'id' },
    select: { id: true },
    // Node refetches must apply the same visibility rule as root fields.
    findUnique: (id, context) => ({
      id: Number(id),
      OR: [{ published: true }, { authorId: context.userId }],
    }),
    fields: (t) => ({
      title: t.exposeString('title'),
      published: t.exposeBoolean('published'),
      author: t.relation('author'),
      comments: t.relation('comments', { query: { orderBy: { id: 'asc' } } }),
      media: t.field({
        type: [Media],
        select: (_args, _ctx, nestedSelection) => ({
          media: { orderBy: { id: 'asc' }, select: { media: nestedSelection(true) } },
        }),
        resolve: (post) => {
          return post.media.map(({ media }) => media);
        },
      }),
    }),
  });
  // #endregion post

  addMediaConnection(builder, Media);

  // #region viewer
  const Viewer = builder.prismaInterface('User', {
    variant: 'Viewer',
    select: { id: true, isAdmin: true },
    resolveType: (user) => (user.isAdmin ? 'EditorViewer' : 'AuthorViewer'),
    fields: (t) => ({
      user: t.variant('User'),
      email: t.exposeString('email'),
      drafts: t.relation('posts', {
        query: { where: { published: false }, orderBy: { id: 'asc' } },
      }),
    }),
  });
  builder.prismaObject('User', {
    variant: 'EditorViewer',
    interfaces: [Viewer],
    select: { id: true, isAdmin: true },
    fields: (t) => ({ canReviewSubmissions: t.boolean({ resolve: () => true }) }),
  });
  builder.prismaObject('User', {
    variant: 'AuthorViewer',
    interfaces: [Viewer],
    select: { id: true, isAdmin: true },
  });
  // #endregion viewer

  // #region filters
  const TitleFilter = builder.prismaFilter('String', { ops: ['contains', 'equals'] });
  const PostWhere = builder.prismaWhere('Post', {
    fields: { title: TitleFilter },
  });
  const PostOrderBy = builder.prismaOrderBy('Post', { fields: { title: true, id: true } });
  // #endregion filters

  // #region author-query
  builder.queryType({
    fields: (t) => ({
      author: t.prismaField({
        type: 'User',
        nullable: true,
        args: { id: t.arg.int({ required: true }) },
        resolve: (query, _root, args) => {
          return prisma.user.findUnique({
            ...query,
            where: { id: args.id },
          });
        },
      }),
    }),
  });
  // #endregion author-query

  // #region queries
  builder.queryFields((t) => ({
    me: t.prismaField({
      type: Viewer,
      resolve: (query, _root, _args, ctx) => {
        return prisma.user.findUniqueOrThrow({
          ...query,
          where: { id: ctx.userId },
        });
      },
    }),
    posts: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      resolve: (query) => {
        return prisma.post.findMany({
          ...query,
          where: { published: true },
          orderBy: { id: 'asc' },
        });
      },
      totalCount: () => {
        return prisma.post.count({
          where: { published: true },
        });
      },
    }),
    searchPosts: t.prismaField({
      type: ['Post'],
      args: { where: t.arg({ type: PostWhere }), orderBy: t.arg({ type: PostOrderBy }) },
      resolve: (query, _root, args) => {
        return prisma.post.findMany({
          ...query,
          // Caller filters can narrow this scope, but cannot expose drafts.
          where: { AND: [{ published: true }, args.where ?? {}] },
          orderBy: args.orderBy ? [args.orderBy, { id: 'asc' }] : { id: 'asc' },
        });
      },
    }),
  }));
  // #endregion queries

  // #region mutations
  const DraftInput = builder.prismaCreate('Post', {
    name: 'DraftInput',
    fields: { title: 'String', content: 'String' },
  });
  const DraftUpdate = builder.prismaUpdate('Post', {
    name: 'DraftUpdate',
    fields: { title: 'String', content: 'String' },
  });
  const CreateDraftResult = builder.objectRef<{ post: PostRow }>('CreateDraftResult').implement({
    fields: (t) => ({ post: t.field({ type: Post, resolve: (result) => result.post }) }),
  });
  builder.mutationType({
    fields: (t) => ({
      createDraft: t.prismaField({
        type: 'Post',
        args: { input: t.arg({ type: DraftInput, required: true }) },
        resolve: (query, _root, args, ctx) => {
          return prisma.post.create({
            ...query,
            data: { ...args.input, author: { connect: { id: ctx.userId } } },
          });
        },
      }),
      updateDraft: t.prismaField({
        type: 'Post',
        args: {
          id: t.arg.int({ required: true }),
          input: t.arg({ type: DraftUpdate, required: true }),
        },
        resolve: (query, _root, args, ctx) => {
          return prisma.post.update({
            ...query,
            where: { id: args.id, authorId: ctx.userId, published: false },
            data: args.input,
          });
        },
      }),
      createDraftWithPayload: t.field({
        type: CreateDraftResult,
        args: {
          title: t.arg.string({ required: true }),
          content: t.arg.string({ required: true }),
        },
        resolve: async (_root, args, context, info) => {
          return {
            post: await prisma.post.create({
              ...queryFromInfo({ context, info, path: ['post'] }),
              data: { ...args, authorId: context.userId },
            }),
          };
        },
      }),
    }),
  });
  // #endregion mutations
  return builder.toSchema();
}
