import { createBuilder, type SampleOptions, type TestRuntimeContext } from '../fixtures/helpers';

export function buildExampleSchema(db: TestRuntimeContext, options: SampleOptions = {}) {
  const builder = createBuilder(options);

  const UserBasic = builder.prismaObject('User', {
    variant: 'UserBasic',
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      posts: t.relation('posts'),
    }),
  });

  const User = builder.prismaNode('User', {
    id: { field: 'id' },
    collection: () => db.orm.User,
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      lastName: t.exposeString('lastName'),
      email: t.exposeString('email'),
      fullName: t.string({
        select: ['firstName', 'lastName'],
        resolve: (user) => `${user.firstName} ${user.lastName}`,
      }),
      constant: t.string({ resolve: () => 'constant' }),
      greeting: t.string({
        args: { formal: t.arg.boolean({ required: true }) },
        select: (args) => (args.formal ? ['lastName'] : ['firstName']),
        resolve: (user, args) =>
          args.formal
            ? `Greetings, ${(user as { lastName?: string }).lastName}`
            : `Hi, ${(user as { firstName?: string }).firstName}`,
      }),
      posts: t.relation('posts'),
      drafts: t.relation('posts', { query: { where: { published: 0 } } }),
      publishedPosts: t.relation('posts', { query: { where: (p) => p.published.eq(1) } }),
      postsByPublished: t.relation('posts', {
        args: { published: t.arg.int({ required: true }) },
        query: (args) => ({ where: (p) => p.published.eq(args.published) }),
      }),
      comments: t.relation('comments'),
      postCount: t.relationCount('posts'),
      publishedCount: t.relationCount('posts', { where: { published: 1 } }),
      countByFlag: t.relationCount('posts', {
        args: { flag: t.arg.int({ required: true }) },
        where: (p, args) => p.published.eq(args.flag),
      }),
      maxPublished: t.relationAggregate('posts', { op: 'max', field: 'published' }),
      minPublished: t.relationAggregate('posts', { op: 'min', field: 'published' }),
      postStats: t.string({
        select: {
          posts: (sub) => ({
            total: sub.count(),
            sumPublished: sub.sum('published'),
            drafts: sub.where({ published: 0 }).count(),
          }),
        },
        resolve: (user) => `${user.total}/${user.sumPublished}/${user.drafts}`,
      }),
      postTitles: t.string({
        select: { posts: true },
        resolve: (user) => user.posts.map((post) => post.title).join(', '),
      }),
      postsConnection: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
      publishedConnection: t.relatedConnection('posts', {
        cursor: 'id',
        totalCount: true,
        where: { published: 1 },
      }),
      basic: t.variant(UserBasic),
    }),
  });

  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      isPublished: t.exposeInt('published'),
      score: t.exposeFloat('score', { nullable: true }),
      author: t.relation('author'),
      comments: t.relation('comments'),
      commentCount: t.relationCount('comments'),
    }),
  });

  builder.prismaObject('Comment', {
    select: ['id'],
    fields: (t) => ({
      ref: t.string({ resolve: (comment) => comment.id }),
      body: t.exposeString('body'),
      author: t.relation('author'),
      post: t.relation('post'),
    }),
  });

  builder.prismaObjectField('Comment', 'shout', (t) =>
    t.string({ select: ['body'], resolve: (comment) => comment.body.toUpperCase() }),
  );

  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: [User], resolve: () => db.orm.User }),
      user: t.prismaField({
        type: User,
        nullable: true,
        args: { email: t.arg.string({ required: true }) },
        resolve: (_root, args) => db.orm.User.where({ email: args.email }),
      }),
      posts: t.prismaField({ type: ['Post'], resolve: () => db.orm.Post }),
      usersConnection: t.prismaConnection({
        type: User,
        cursor: 'id',
        totalCount: true,
        resolve: () => db.orm.User,
      }),
      postsByDate: t.prismaConnection({
        type: 'Post',
        cursor: ['createdAt', 'id'],
        resolve: () => db.orm.Post,
      }),
    }),
  });

  return builder.toSchema();
}
