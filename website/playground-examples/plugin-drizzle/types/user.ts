import { eq } from 'drizzle-orm';
import { builder } from '../builder';
import { posts } from '../tables';

// #region user
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  select: {},
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    // #region user-full-name
    fullName: t.string({
      select: { columns: { firstName: true, lastName: true } },
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    // #endregion user-full-name
    // #region user-lowercase-name
    lowercaseName: t.string({
      select: {
        extras: {
          lowercaseName: (users, { sql }) => sql<string>`lower(${users.firstName})`,
        },
      },
      resolve: (user) => user.lowercaseName,
    }),
    // #endregion user-lowercase-name
    // #region user-bio
    bio: t.string({
      nullable: true,
      select: { with: { profile: true } },
      resolve: (user) => user.profile?.bio,
    }),
    // #endregion user-bio
    // #region user-posts
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
    // #endregion user-posts
    // #region user-post-count
    postCount: t.relatedCount('posts', { where: eq(posts.published, true) }),
    // #endregion user-post-count
    // #region user-posts-connection
    postsConnection: t.relatedConnection('posts', {
      query: { where: { published: true }, orderBy: { createdAt: 'desc' } },
      totalCount: true,
    }),
    // #endregion user-posts-connection
  }),
});
// #endregion user
