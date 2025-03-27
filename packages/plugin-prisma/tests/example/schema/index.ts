import {
  type ResolveCursorConnectionArgs,
  resolveArrayConnection,
  resolveCursorConnection,
} from '@pothos/plugin-relay';
import { prismaConnectionHelpers } from '../../../src';
import { queryFromInfo } from '../../../src/util/map-query';
import type { Post } from '../../client';
import builder, { prisma } from '../builder';
import {
  DirectiveLocation,
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLNonNull,
  GraphQLString,
} from 'graphql';

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

builder.globalConnectionField('totalCount', (t) =>
  t.int({
    description: 'default totalCount field for all connections',
    resolve: (connection) => {
      if ('totalCount' in connection && typeof connection.totalCount === 'number') {
        return connection.totalCount;
      }

      return 0;
    },
  }),
);

const PostPreview = builder.objectRef<Post>('PostPreview').implement({
  fields: (t) => ({
    post: t.field({
      type: SelectPost,
      resolve: (post) => post,
    }),
    preview: t.string({
      nullable: true,
      resolve: (post) => post.content?.slice(10),
    }),
  }),
});

const postConnectionHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  args: (t) => ({
    oldestFirst: t.boolean({ required: true }),
  }),
  select: (nodeSelection, args) => ({
    post: nodeSelection({
      include: {
        comments: {
          orderBy: {
            createdAt: args.oldestFirst ? ('asc' as const) : ('desc' as const),
          },
          take: 3,
          include: {
            author: true,
          },
        },
      },
    }),
  }),
  resolveNode: ({ post }) => post,
});

const Viewer = builder.prismaInterface('User', {
  variant: 'Viewer',
  select: {
    id: true,
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', {
      query: {
        take: 5,
      },
    }),
    postCount: t.int({
      select: () => ({
        _count: {
          select: {
            posts: true,
          },
        },
      }),
      resolve: (user) => user._count.posts,
    }),
    selectUser: t.variant(SelectUser),
    bio: t.string({
      select: {
        profile: {
          select: {
            bio: true,
          },
        },
      },
      nullable: true,
      resolve: (user) => user.profile?.bio,
    }),

    comments: t.connection({
      type: PostRef,
      args: postConnectionHelpers.getArgs(),
      select: (args, ctx, nestedSelection) => ({
        comments: postConnectionHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (user, args, ctx) => postConnectionHelpers.resolve(user.comments, args, ctx),
    }),
    commentsWithNewQuery: t.connection({
      type: PostRef,
      args: postConnectionHelpers.getArgs(),
      resolve: async (user, args, ctx, info) => {
        const comments = await prisma.comment.findMany({
          ...(queryFromInfo({
            context: ctx,
            info,
            path: ['edges', 'node'],
            select: {
              post: {
                include: {
                  author: true,
                  comments: true,
                },
              },
            },
          }) as {
            include: {
              post: { include: { comments: { include: { author: true } } } };
            };
          }),
          where: {
            authorId: user.id,
          },
        });

        return postConnectionHelpers.resolve(comments, args, ctx);
      },
    }),
    aComments: t.relatedConnection(
      'comments',
      {
        cursor: 'id',
        query: {
          where: {
            content: {
              startsWith: 'A',
            },
          },
        },
      },
      CommentConnection,
    ),
  }),
  resolveType: () => 'NormalViewer',
});

builder.prismaInterfaceField(Viewer, 'user', (t) => t.variant('User'));
builder.prismaInterfaceFields(Viewer, (t) => ({
  postPreviews: t.field({
    select: (_args, _ctx, nestedSelection) => ({
      posts: nestedSelection(
        {
          take: 2,
        },
        ['post'],
      ),
    }),
    type: [PostPreview],
    resolve: (user) => user.posts,
  }),
}));

const NormalViewer = builder.prismaObject('User', {
  variant: 'NormalViewer',
  select: {
    id: true,
  },
  interfaces: [Viewer],
  fields: (t) => ({
    isNormal: t.boolean({
      resolve: () => true,
    }),
    reverseName: t.string({
      select: {
        name: true,
      },
      nullable: true,
      resolve: (user) => user.name?.split('').reverse().join(''),
    }),
    aComments: t.relatedConnection(
      'comments',
      {
        cursor: 'id',
        query: {
          where: {
            content: {
              startsWith: 'b',
            },
          },
        },
      },
      CommentConnection,
    ),
  }),
});

const ViewerNode = builder.prismaNode('User', {
  variant: 'ViewerNode',
  include: {
    profile: true,
  },
  id: {
    field: 'id',
  },
  fields: (t) => ({
    bio: t.string({
      nullable: true,
      resolve: (user) => user.profile?.bio,
    }),
  }),
});

builder.prismaObject('Follow', {
  name: 'UserFollow',
  fields: (t) => ({
    to: t.relation('to'),
    from: t.relation('from'),
  }),
});

const User = builder.prismaNode('User', {
  interfaces: [Named],
  id: {
    field: 'id',
  },
  nullable: true,
  fields: (t) => ({
    viewer: t.variant(Viewer, {
      isNull: (user, _args, ctx) => user.id !== ctx.user.id,
    }),
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    profile: t.relation('profile', {
      nullable: true,
    }),
    profileWithErrors: t.relation('profile', {
      nullable: true,
      errors: {},
    }),
    directProfileWithErrors: t.relation('profile', {
      nullable: true,
      errors: { directResult: true },
    }),
    postCount: t.relationCount('posts'),
    publishedCount: t.relationCount('posts', {
      where: {
        published: true,
      },
    }),
    filteredCount: t.relationCount('posts', {
      args: {
        published: t.arg.boolean({ required: true }),
      },
      where: (args) => ({
        published: args.published,
      }),
    }),
    posts: t.relation('posts', {
      args: {
        oldestFirst: t.arg.boolean(),
        createdAt: t.arg.string(),
        limit: t.arg.int(),
        id: t.arg.globalID(),
      },
      query: (args) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
        where: args.createdAt
          ? {
              createdAt: new Date(args.createdAt),
              id: args.id ? Number.parseInt(args.id.id, 10) : undefined,
            }
          : undefined,
        take: args.limit ?? 10,
      }),
      resolve: (query, user) =>
        prisma.post.findMany({
          ...query,
          where: { ...(query as { where?: object }).where, authorId: user.id },
        }),
    }),
    postNodes: t.relation('posts', {
      type: SelectPost,
      args: {
        limit: t.arg.int(),
        id: t.arg.globalID(),
      },
      query: (args) => ({
        where: args.id
          ? {
              id: args.id ? Number.parseInt(args.id.id, 10) : undefined,
            }
          : undefined,
        take: args.limit ?? 3,
      }),
      resolve: (query, user) =>
        prisma.post.findMany({
          ...query,
          where: { ...(query as { where?: object }).where, authorId: user.id },
        }),
    }),
    postsConnection: t.relatedConnection(
      'posts',
      {
        totalCount: true,
        cursor: 'createdAt',
        args: {
          oldestFirst: t.arg.boolean(),
          published: t.arg.boolean(),
        },
        query: (args) => ({
          ...(args.published == null ? {} : { where: { published: args.published } }),
          orderBy: {
            createdAt: args.oldestFirst ? 'asc' : 'desc',
          },
        }),
      },
      {
        fields: (con) => ({
          test: con.boolean({
            nullable: true,
            resolve: (p) => p.args.oldestFirst,
          }),
        }),
      },
      {
        fields: (edge) => ({
          test: edge.boolean({
            nullable: true,
            resolve: (p) => p.connection.args.oldestFirst,
          }),
        }),
      },
    ),
    postsSkipConnection: t.relatedConnection('posts', {
      totalCount: true,
      cursor: 'createdAt',
      args: {
        skip: t.arg.int(),
        take: t.arg.int(),
      },
      query: (args) => ({
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
      }),
    }),
    postsConnectionWithErrors: t.relatedConnection('posts', {
      errors: {},
      cursor: 'createdAt',
    }),
    profileThroughManualLookup: t.field({
      type: Profile,
      nullable: true,
      resolve: (user) => prisma.user.findUnique({ where: { id: user.id } }).profile(),
    }),
    commentsConnection: t.relatedConnection('comments', { cursor: 'id' }),
    commentedPosts: t.relation('posts', {
      query: (_args, ctx) => ({
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
      query: (_args, ctx) => ({
        where: {
          comments: {
            some: {
              authorId: ctx.user.id,
            },
          },
        },
      }),
    }),
    following: t.relatedConnection('following', {
      cursor: 'compositeID',
    }),
    prismaFieldComments: t.prismaField({
      type: ['Comment'],
      select: {
        comments: true,
      },
      resolve: (_query, user) => user.comments,
    }),
  }),
});

const NamedUnion = builder.unionType('NamedUnion', {
  types: [User, NormalViewer],
});

const Media = builder.prismaObject('Media', {
  select: {
    id: true,
  },
  fields: (t) => ({
    url: t.exposeString('url'),
  }),
});

const MediaConnection = builder.connectionObject({
  type: Media,
  name: 'MediaConnection',
});

builder.prismaObjectField('Post', 'mediaConnection', (t) =>
  t.connection(
    {
      type: Media,
      args: mediaConnectionHelpers.getArgs(),
      select: (args, ctx, nestedSelection) => ({
        media: mediaConnectionHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (post, args, ctx) => mediaConnectionHelpers.resolve(post.media, args, ctx),
    },
    MediaConnection,
  ),
);

const mediaConnectionHelpers = prismaConnectionHelpers(builder, 'PostMedia', {
  cursor: 'postId_mediaId',
  args: (t) => ({
    reversed: t.boolean(),
  }),
  select: (nodeSelection) => ({
    order: true,
    media: nodeSelection({
      select: {
        id: true,
        posts: true,
      },
    }),
  }),
  query: (args) => ({
    orderBy: {
      id: args.reversed ? ('desc' as const) : ('asc' as const),
    },
  }),
  resolveNode: (postMedia) => postMedia.media,
});

builder.prismaObjectFields('Post', (t) => ({
  manualMediaConnection: t.connection(
    {
      type: Media,
      args: {
        ...mediaConnectionHelpers.getArgs(),
        inverted: t.arg.boolean(),
      },
      select: (args, ctx, nestedSelection) => ({
        _count: {
          select: {
            media: true,
          },
        },
        media: {
          ...mediaConnectionHelpers.getQuery(args, ctx, nestedSelection),
          orderBy: {
            post: {
              createdAt: args.inverted ? 'desc' : 'asc',
            },
          },
        },
      }),
      resolve: (post, args, ctx) => ({
        totalCount: post._count.media,
        ...mediaConnectionHelpers.resolve(post.media, args, ctx),
      }),
    },
    {
      fields: (con) => ({
        totalCount: con.exposeInt('totalCount', {
          nullable: true,
        }),
      }),
    },
    {
      fields: (edge) => ({
        order: edge.int({
          resolve: (media) => media.order,
        }),
      }),
    },
  ),
  named: t.field({
    type: [Named],
    nullable: {
      items: true,
      list: true,
    },
    select: (_args, _ctx, nestedSelection) => ({
      author: nestedSelection({}, [], 'User'),
    }),
    resolve: (post) => (post.author ? User.addBrand([post.author]) : []),
  }),
  namedUnion: t.field({
    type: [NamedUnion],
    nullable: {
      items: true,
      list: true,
    },
    select: (_args, _ctx, nestedSelection) => ({
      author: nestedSelection({}, [], 'NormalViewer'),
    }),
    resolve: (post) => (post.author ? NormalViewer.addBrand([post.author]) : []),
  }),
}));

const SelectUser = builder.prismaNode('User', {
  variant: 'SelectUser',
  id: {
    field: 'id',
  },
  select: {
    id: true,
  },
  fields: (t) => ({
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    profile: t.relation('profile', {
      nullable: false,
      onNull: 'error',
    }),
    postCount: t.relationCount('posts'),
    following: t.relatedConnection('following', {
      complexity: (args) => args.first ?? 1,
      cursor: 'compositeID',
    }),
    posts: t.relation('posts', {
      type: SelectPost,
      query: {
        take: 5,
      },
    }),
    postsConnection: t.relatedConnection('posts', {
      type: SelectPost,
      args: {
        oldestFirst: t.arg.boolean(),
      },
      complexity: (args) => (args.oldestFirst ? 1 : 0),
      query: (args) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
      cursor: 'id',
      totalCount: true,
    }),
  }),
});

const commentConnectionHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
});

const CommentConnection = builder.connectionObject({
  type: commentConnectionHelpers.ref,
  name: 'CommentConnection',
});

const SelectPost = builder.prismaNode('Post', {
  variant: 'SelectPost',
  id: {
    field: 'id',
  },
  select: {
    id: true,
  },
  fields: (t) => ({
    title: t.exposeString('title'),
    content: t.exposeString('content', {
      description: false,
      nullable: true,
    }),
    createdAt: t.string({
      select: {
        createdAt: true,
      },
      resolve: (post) => post.createdAt.toISOString(),
    }),
    comments: t.connection(
      {
        type: commentConnectionHelpers.ref,
        select: (args, ctx, nestedSelection) => ({
          comments: commentConnectionHelpers.getQuery(args, ctx, nestedSelection),
        }),
        resolve: async (parent, args, ctx) => {
          const result = await commentConnectionHelpers.resolve(parent.comments, args, ctx);

          return {
            ...result,
            edges: result.edges.map((edge) => ({
              ...edge,
              parent,
            })),
          };
        },
      },
      CommentConnection,
    ),
  }),
});

builder.queryField('selectPost', (t) =>
  t.prismaField({
    type: SelectPost,
    args: {
      id: t.arg.globalID({ required: true }),
    },
    resolve: (query, _, args) =>
      prisma.post.findUniqueOrThrow({
        ...query,
        where: { id: Number.parseInt(args.id.id, 10) },
      }),
  }),
);

const Profile = builder.prismaObject('Profile', {
  // Testing that user is typed correctly
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio', {
      nullable: true,
    }),
    user: t.relation('user', {
      nullable: true,
      resolve: (query, profile, _args, _ctx, _info) =>
        prisma.user.findUnique({
          ...query,
          where: {
            id: profile.userId,
          },
        }),
    }),
  }),
});

const CircularComment = builder.prismaObject('Comment', {
  variant: 'CircularComment',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.prismaObjectField(CircularComment, 'author', (t) =>
  t.relation('author', { type: CircularUser }),
);

const CircularUser = builder.prismaObject('User', {
  variant: 'CircularUser',
  fields: (t) => ({
    id: t.exposeID('id'),
    comments: t.relation('comments', {
      type: CircularComment,
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

const PostRef = builder.prismaObject('Post', {
  include: {
    comments: {
      take: 3,
      include: {
        author: true,
      },
    },
  },
  fields: (t) => ({
    id: t.id({
      resolve: (parent) => parent.id,
    }),
    views: t.expose('views', { type: 'Decimal' }),
    viewsFloat: t.float({
      resolve: (parent) => parent.views.toNumber(),
    }),
    title: t.exposeString('title'),
    published: t.exposeBoolean('published'),
    content: t.exposeString('content', {
      description: false,
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
    comments: t.relation('comments', {
      query: {
        take: 3,
      },
    }),
    commentsConnection: t.relatedConnection('comments', { cursor: 'id' }, CommentConnection),
    ownComments: t.relation('comments', {
      query: (_args, ctx) => ({ where: { authorId: ctx.user.id } }),
    }),
    ownCommentsConnection: t.relatedConnection('comments', {
      cursor: 'id',
      query: (_args, ctx) => ({ where: { authorId: ctx.user.id } }),
    }),
    media: t.field({
      select: (_args, _ctx, nestedSelection) => ({
        media: {
          select: {
            order: true,
            media: nestedSelection({
              select: {
                id: true,
                posts: true,
              },
            }),
          },
        },
      }),
      type: [Media],
      resolve: (post) => post.media.map(({ media }) => media),
    }),
  }),
});

builder.prismaObject('Comment', {
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
    postAuthor: t.field({
      select: (_args, _ctx, nestedSelection) => ({
        post: {
          select: {
            author: nestedSelection(true),
          },
        },
      }),
      type: User,
      resolve: (comment) => comment.post.author,
    }),
  }),
});

builder.prismaObject('Unrelated', {
  fields: (t) => ({
    id: t.id({
      resolve: (parent) => parent.id,
    }),
    name: t.exposeString('name', { nullable: true }),
  }),
});

builder.queryType({
  fields: (t) => ({
    viewer: t.prismaField({
      type: Viewer,
      resolve: (query, _root, _args, ctx, _info) =>
        prisma.user.findUniqueOrThrow({
          ...query,
          where: { id: ctx.user.id },
        }),
    }),
    viewerNode: t.prismaField({
      type: ViewerNode,
      resolve: (query, _root, _args, ctx, _info) =>
        prisma.user.findUniqueOrThrow({
          ...query,
          where: { id: ctx.user.id },
        }),
    }),
    me: t.prismaField({
      type: 'User',
      nullable: true,
      resolve: (query, _root, _args, ctx, _info) =>
        prisma.user.findUnique({
          ...query,
          where: { id: ctx.user.id },
        }),
    }),
    selectMe: t.prismaField({
      type: SelectUser,
      nullable: true,
      resolve: (query, _root, _args, ctx, _info) =>
        prisma.user.findUnique({
          ...query,
          where: { id: ctx.user.id },
        }),
    }),
    users: t.prismaField({
      type: ['User'],
      resolve: async (query, _root, _args, _ctx, _info) =>
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
      resolve: (query, _root, args) =>
        prisma.post.findUnique({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
        }),
    }),
    posts: t.prismaField({
      type: ['Post'],
      resolve: (query, _root, _args) => prisma.post.findMany({ ...query, take: 3 }),
    }),
    selectPosts: t.prismaField({
      type: [SelectPost],
      resolve: (query, _root, _args) => prisma.post.findMany({ ...query, take: 3 }),
    }),
    usersWithError: t.prismaField({
      errors: {},
      type: ['User'],
      resolve: async (query, _root, _args, _ctx, _info) =>
        prisma.user.findMany({
          ...query,
          take: 2,
        }),
    }),
    userConnection: t.prismaConnection(
      {
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        maxSize: 15,
        args: {
          test: t.arg.boolean({}),
        },
        complexity: (args) => (args.test ? 1 : 0),
        resolve: async (query, _parent, _args) => prisma.user.findMany({ ...query }),
        totalCount: (_parent, _args, _context, _info) => prisma.user.count(),
      },
      {
        fields: (e) => ({
          test: e.string({
            resolve: (parent) => String(parent.args.test),
          }),
        }),
      },
      {
        fields: (e) => ({
          test: e.boolean({
            nullable: true,
            resolve: (parent) => parent.connection.args.test,
          }),
        }),
      },
    ),
    userNodeConnection: t.prismaConnection({
      type: User,
      cursor: 'id',
      resolve: (query) => prisma.user.findMany({ ...query }),
    }),

    unrelatedConnection: t.prismaConnection(
      {
        type: 'Unrelated',
        cursor: 'id',
        resolve: async (query, parent, _args) => {
          const things = await prisma.unrelated.findMany({ ...query });

          return things.map((thing) => ({ ...thing, parent }));
        },
      },
      {},
      {},
    ),
    userConnectionWithErrors: t.prismaConnection({
      type: 'User',
      cursor: 'id',
      defaultSize: 10,
      maxSize: 15,
      errors: {},
      resolve: async (query, _parent, _args) => prisma.user.findMany({ ...query }),
    }),
    nullableUserConnection: t.prismaConnection({
      type: 'User',
      nullable: true,
      cursor: 'id',
      defaultSize: 10,
      maxSize: 15,
      resolve: (query, _parent, args) => {
        if (args.first === 0) {
          return null;
        }

        return prisma.user.findMany({ ...query });
      },
    }),
    named: t.field({
      type: [Named],
      nullable: {
        items: true,
        list: true,
      },
      resolve: async () => {
        const user = await prisma.user.findFirstOrThrow({ where: { id: 1 } });
        return [User.addBrand({ ...user }), user];
      },
    }),
    namedUnion: t.field({
      type: [NamedUnion],
      nullable: {
        items: true,
        list: true,
      },
      resolve: async () => {
        const user = await prisma.user.findFirstOrThrow({ where: { id: 1 } });
        return [User.addBrand({ ...user })];
      },
    }),
    namedWithQuery: t.field({
      type: [Named],
      nullable: {
        items: true,
        list: true,
      },
      resolve: async (_root, _args, context, info) => {
        const user = await prisma.user.findFirstOrThrow({
          where: { id: 1 },
          ...queryFromInfo({
            context,
            info,
            typeName: 'User',
          }),
        });
        return [User.addBrand({ ...user }), user];
      },
    }),
    namedUnionWithQuery: t.field({
      type: [NamedUnion],
      nullable: {
        items: true,
        list: true,
      },
      resolve: async (_root, _args, context, info) => {
        const user = await prisma.user.findFirstOrThrow({
          where: { id: 1 },
          ...queryFromInfo({
            context,
            info,
            typeName: 'User',
          }),
        });
        return [User.addBrand({ ...user })];
      },
    }),
    userOrProfile: t.field({
      type: [UserOrProfile],
      nullable: {
        items: true,
        list: true,
      },
      resolve: async () => {
        const user = User.addBrand(await prisma.user.findFirstOrThrow({ where: { id: 1 } }));

        const profile = await prisma.profile.findUniqueOrThrow({
          where: { id: 1 },
        });

        return [user, profile];
      },
    }),
  }),
});

builder.prismaObject('WithID', {
  fields: (t) => ({
    id: t.exposeID('id'),
    relations: t.relation('FindUniqueRelations'),
  }),
});

const WithIDSelect = builder.prismaObject('WithID', {
  variant: 'WithIDSelect',
  select: {},
  fields: (t) => ({
    id: t.exposeID('id'),
    relations: t.relation('FindUniqueRelations'),
  }),
});

builder.queryField('withIDSelectConnection', (t) =>
  t.prismaConnection({
    type: WithIDSelect,
    cursor: 'id',
    resolve: (query, _parent, _args) => prisma.withID.findMany({ ...query }),
  }),
);

const WithIDNode = builder.prismaNode('WithID', {
  variant: 'WithIDNode',
  id: {
    field: 'id',
  },
  fields: (t) => ({
    relations: t.relation('FindUniqueRelations'),
  }),
});

builder.prismaObject('WithUnique', {
  fields: (t) => ({
    id: t.exposeID('id'),
    relations: t.relation('FindUniqueRelations'),
  }),
});

const WithUniqueNode = builder.prismaNode('WithUnique', {
  variant: 'WithUniqueNode',
  id: {
    field: 'id',
  },
  fields: (t) => ({
    relations: t.relation('FindUniqueRelations'),
  }),
});

builder.prismaObject('WithCompositeID', {
  fields: (t) => ({
    id: t.exposeID('a'),
    relations: t.relation('FindUniqueRelations'),
  }),
});

const WithCompositeIDNode = builder.prismaNode('WithCompositeID', {
  variant: 'WithCompositeIDNode',
  id: {
    field: 'a_b',
  },
  fields: (t) => ({
    relations: t.relation('FindUniqueRelations'),
  }),
});

builder.prismaObject('WithCompositeUnique', {
  fields: (t) => ({
    id: t.exposeID('a'),
    relations: t.relation('FindUniqueRelations'),
  }),
});

const WithCompositeUniqueNode = builder.prismaNode('WithCompositeUnique', {
  variant: 'WithCompositeUniqueNode',
  id: {
    field: 'a_b',
  },
  fields: (t) => ({
    relations: t.relation('FindUniqueRelations'),
  }),
});

const WithCompositeUniqueNodeSelect = builder.prismaNode('WithCompositeUnique', {
  variant: 'WithCompositeUniqueNodeSelect',
  id: {
    field: 'a_b',
  },
  select: {},
  fields: (t) => ({
    relations: t.relation('FindUniqueRelations'),
  }),
});

builder.queryField('withCompositeConnection', (t) =>
  t.prismaConnection({
    type: WithCompositeUniqueNodeSelect,
    cursor: 'a_b',
    complexity: (args) => args.first ?? 1,
    resolve: (query, _parent, _args) => prisma.withCompositeUnique.findMany({ ...query }),
  }),
);

const WithCompositeUniqueCustom = builder.prismaObject('WithCompositeUnique', {
  variant: 'WithCompositeUniqueCustom',
  findUnique: (obj) => ({
    a_c: {
      a: obj.a,
      c: obj.c!,
    },
  }),
  fields: (t) => ({
    id: t.exposeID('a'),
    relations: t.relation('FindUniqueRelations'),
  }),
});

const WithCompositeUniqueNodeCustom = builder.prismaNode('WithCompositeUnique', {
  variant: 'WithCompositeUniqueNodeCustom',
  id: {
    resolve: (obj) => obj.a,
  },
  findUnique: (id) => ({
    a_c: {
      a: id,
      c: id,
    },
  }),
  fields: (t) => ({
    relations: t.relation('FindUniqueRelations'),
  }),
});

builder.queryFields((t) => ({
  findUniqueRelations: t.prismaField({
    type: 'FindUniqueRelations',
    resolve: (query) => {
      // biome-ignore lint/complexity/noVoid: <explanation>
      void query.include;

      return prisma.findUniqueRelations.findUniqueOrThrow({
        where: {
          id: '1',
        },
        include: {
          withID: true,
          withUnique: true,
          withCompositeID: true,
          withCompositeUnique: true,
        },
      });
    },
  }),
  findUniqueRelationsSelect: t.prismaField({
    type: 'FindUniqueRelations',
    resolve: (query) =>
      prisma.findUniqueRelations.findUniqueOrThrow({
        ...query,
        where: {
          id: '1',
        },
      }),
  }),
  badUser: t.prismaField({
    type: 'User',
    resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }),
  }),
  postsBigIntCursor: t.prismaConnection({
    type: 'Post',
    cursor: 'bigIntId',
    resolve: (query) => prisma.post.findMany({ ...query }),
  }),
}));

builder.prismaObject('FindUniqueRelations', {
  fields: (t) => ({
    id: t.exposeID('id'),
    withID: t.relation('withID'),
    withIDSelect: t.relation('withID', { type: WithIDSelect }),
    withUnique: t.relation('withUnique'),
    withCompositeID: t.relation('withCompositeID'),
    withCompositeUnique: t.relation('withCompositeUnique'),
    withIDNode: t.relation('withID', {
      type: WithIDNode,
    }),
    withUniqueNode: t.relation('withUnique', {
      type: WithUniqueNode,
    }),
    withCompositeIDNode: t.relation('withCompositeID', {
      type: WithCompositeIDNode,
    }),
    withCompositeUniqueNode: t.relation('withCompositeUnique', {
      type: WithCompositeUniqueNode,
    }),
    withCompositeUniqueNodeSelect: t.relation('withCompositeUnique', {
      type: WithCompositeUniqueNodeSelect,
    }),
    withCompositeUniqueCustom: t.relation('withCompositeUnique', {
      type: WithCompositeUniqueCustom,
    }),
    withCompositeUniqueNodeCustom: t.relation('withCompositeUnique', {
      type: WithCompositeUniqueNodeCustom,
    }),
  }),
});

builder.queryField('manualConnection', (t) =>
  t.connection({
    type: PostRef,
    resolve: (_, args) =>
      resolveCursorConnection(
        {
          args,
          toCursor: (media) => media.createdAt.toISOString(),
        },
        ({ before, after, limit, inverted }: ResolveCursorConnectionArgs) =>
          prisma.post.findMany({
            take: limit,
            include: {
              comments: {
                include: {
                  author: true,
                },
              },
            },
            where: {
              createdAt: {
                lt: before,
                gt: after,
              },
            },
            orderBy: {
              createdAt: inverted ? 'desc' : 'asc',
            },
          }),
      ),
  }),
);

const Blog = builder.objectRef<{ posts: Post[]; pages: number[] }>('Blog').implement({
  fields: (t) => ({
    posts: t.prismaField({
      type: ['Post'],
      resolve: (query, blog) => {
        // biome-ignore lint/complexity/noVoid: <explanation>
        void query.include;

        return blog.posts;
      },
    }),
    pages: t.exposeIntList('pages'),
  }),
});

builder.queryField('blog', (t) =>
  t.field({
    type: Blog,
    resolve: async (_, _args, context, info) => {
      const query = queryFromInfo({
        context,
        info,
        typeName: 'Post',
        path: ['posts'],
        include: { author: true },
      });

      return {
        posts: await prisma.post.findMany({
          ...query,
          take: 3,
        }),
        pages: [1, 2, 3],
      };
    },
  }),
);

builder.queryField('namedConnection', (t) =>
  t.connection({
    type: Named,
    resolve: async (_, args, context, info) => {
      const users = await prisma.user.findMany({
        orderBy: {
          id: 'asc',
        },
        ...queryFromInfo({
          context,
          info,
          typeName: 'User',
          path: ['edges', 'node'],
        }),
      });

      return resolveArrayConnection({ args }, User.addBrand(users));
    },
  }),
);

export default builder.toSchema({
  directives: [
    new GraphQLDirective({
      name: 'defer',
      description:
        'Directs the executor to defer this fragment when the `if` argument is true or undefined.',
      locations: [DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT],
      args: {
        if: {
          type: new GraphQLNonNull(GraphQLBoolean),
          description: 'Deferred when true or undefined.',
          defaultValue: true,
        },
        label: {
          type: GraphQLString,
          description: 'Unique name',
        },
      },
    }),
  ],
});
