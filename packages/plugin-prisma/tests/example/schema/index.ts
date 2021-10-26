import builder, { prisma } from '../builder';

const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

builder.objectType(Error, {
  name: 'BaseError',
  isTypeOf: (obj) => obj instanceof Error,
  interfaces: [ErrorInterface],
});

const Named = builder.interfaceRef<{ name: string | null }>('Named').implement({
  fields: (t) => ({
    name: t.string({ nullable: true }),
  }),
});

const User = builder.prismaNode('User', {
  interfaces: [Named],
  id: {
    resolve: (user) => user.id,
  },
  findUnique: (id) => ({ id: Number.parseInt(id, 10) }),
  fields: (t) => ({
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    profile: t.relation('profile', {
      nullable: true,
    }),
    profileWithErrors: t.relation('profile', { nullable: true, errors: {} }),
    postCount: t.relationCount('posts'),
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
      totalCount: true,
      cursor: 'createdAt',
      args: {
        oldestFirst: t.arg.boolean(),
      },
      query: (args) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
    postsConnectionWithErrors: t.relatedConnection('posts', {
      errors: {},
      cursor: 'createdAt',
    }),
    profileThroughManualLookup: t.field({
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      type: Profile,
      nullable: true,
      resolve: (user) => prisma.user.findUnique({ where: { id: user.id } }).profile(),
    }),
    commentsConnection: t.relatedConnection('comments', { cursor: 'id' }),
    commentedPosts: t.relation('posts', {
      query: (args, ctx) => ({
        take: 3,
        where: {
          comments: {
            some: {
              authorId: ctx.user.id,
            },
          },
        },
      }),
    }),
    commentedPostsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: (args, ctx) => ({
        where: {
          comments: {
            some: {
              authorId: ctx.user.id,
            },
          },
        },
      }),
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

const UserOrProfile = builder.unionType('UserOrProfile', {
  types: [User, Profile],
  resolveType: (val) => {
    if (User.hasBrand(val)) {
      return User;
    }

    if ('bio' in val) {
      return Profile;
    }

    return null;
  },
});

builder.prismaObject('Post', {
  findUnique: (post) => ({ id: post.id }),
  include: {
    comments: {
      include: {
        author: true,
      },
    },
  },
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
    post: t.relation('author'),
    commentAuthorIds: t.idList({
      resolve: (post) => [...new Set(post.comments.map((comment) => comment.author.id))],
    }),
    comments: t.relation('comments'),
    commentsConnection: t.relatedConnection('comments', { cursor: 'id' }),
    ownComments: t.relation('comments', {
      query: (args, ctx) => ({ where: { authorId: ctx.user.id } }),
    }),
    ownCommentsConnection: t.relatedConnection('comments', {
      cursor: 'id',
      query: (args, ctx) => ({ where: { authorId: ctx.user.id } }),
    }),
  }),
});

builder.prismaObject('Comment', {
  findUnique: (comment) => ({ id: comment.id }),
  include: {
    author: {
      include: {
        profile: true,
      },
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    authorBio: t.string({ nullable: true, resolve: (comment) => comment.author.profile?.bio }),
    author: t.relation('author'),
    post: t.relation('post'),
    content: t.exposeString('content'),
  }),
});

builder.prismaObject('Unrelated', {
  findUnique: (post) => ({ id: post.id }),
  fields: (t) => ({
    id: t.id({
      resolve: (parent) => parent.id,
    }),
    name: t.exposeString('name', { nullable: true }),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: 'User',
      nullable: true,
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findUnique({
          ...query,
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
    post: t.prismaField({
      type: 'Post',
      args: {
        id: t.arg.id({ required: true }),
      },
      nullable: true,
      resolve: (query, root, args) =>
        prisma.post.findUnique({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
        }),
    }),
    posts: t.prismaField({
      type: ['Post'],
      resolve: (query, root, args) => prisma.post.findMany({ ...query, take: 3 }),
    }),
    usersWithError: t.prismaField({
      errors: {},
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
    unrelatedConnection: t.prismaConnection({
      type: 'Unrelated',
      cursor: 'id',
      resolve: (query, parent, args) => prisma.unrelated.findMany({ ...query }),
    }),
    userConnectionWithErrors: t.prismaConnection({
      type: 'User',
      cursor: 'id',
      defaultSize: 10,
      maxSize: 15,
      errors: {},
      resolve: async (query, parent, args) => prisma.user.findMany({ ...query }),
    }),
    named: t.field({
      type: [Named],
      nullable: {
        items: true,
        list: true,
      },
      resolve: async () => {
        const user = await prisma.user.findFirst({ rejectOnNotFound: true, where: { id: 1 } });
        return [User.addBrand({ ...user }), user];
      },
    }),
    userOrProfile: t.field({
      type: [UserOrProfile],
      nullable: {
        items: true,
        list: true,
      },
      resolve: async () => {
        const user = User.addBrand(
          await prisma.user.findFirst({ rejectOnNotFound: true, where: { id: 1 } }),
        );

        const profile = await prisma.profile.findUnique({
          rejectOnNotFound: true,
          where: { id: 1 },
        });

        return [user, profile];
      },
    }),
  }),
});

export default builder.toSchema({});
