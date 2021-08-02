import builder, { prisma } from '../builder';

builder.prismaNode('User', {
  id: {
    resolve: (user) => user.id,
  },
  findUnique: (id) => ({ id: Number.parseInt(id, 10) }),
  fields: (t) => ({
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    profile: t.relation('profile'),
    posts: t.relation('posts', {
      args: {
        oldestFirst: t.arg.boolean(),
      },
      query: (args) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
        take: 10,
      }),
      resolve: (query, user) =>
        prisma.post.findMany({
          ...query,
          where: { authorId: user.id },
        }),
    }),
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
    }),
    profileThroughManualLookup: t.field({
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      type: Profile,
      nullable: true,
      resolve: (user) => prisma.user.findUnique({ where: { id: user.id } }).profile(),
    }),
  }),
});

const Profile = builder.prismaObject('Profile', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio', {
      nullable: true,
    }),
    user: t.relation('user', {
      nullable: true,
      resolve: (query, profile, args, ctx, info) =>
        prisma.user.findUnique({
          where: {
            id: profile.userId,
          },
          ...query,
        }),
    }),
  }),
});

builder.prismaObject('Post', {
  findUnique: (post) => ({ id: post.id }),
  fields: (t) => ({
    id: t.id({
      resolve: (parent) => parent.id,
    }),
    title: t.exposeString('title'),
    content: t.exposeString('content', {
      nullable: true,
    }),
    createdAt: t.string({
      resolve: (post) => post.createdAt.toISOString(),
    }),
    author: t.relation('author'),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findUnique({
          ...query,
          rejectOnNotFound: true,
          where: { id: ctx.user.id },
        }),
    }),
    users: t.prismaField({
      type: ['User'],
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findMany({
          ...query,
          take: 2,
        }),
    }),
    userConnection: t.prismaConnection({
      type: 'User',
      cursor: 'id',
      defaultSize: 10,
      maxSize: 15,
      resolve: async (query, parent, args) => prisma.user.findMany({ ...query }),
    }),
  }),
});

export default builder.toSchema({});
