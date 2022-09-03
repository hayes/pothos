import builder from '../builder';
import { posts, Status, users } from '../data';

builder.enumType(Status, {
  name: 'Status',
});

const Post = builder.objectRef<typeof posts[number]>('Post');

Post.implement({
  authz: {
    rules: ['CanReadPost'],
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    body: t.exposeString('body'),
    status: t.expose('status', {
      type: Status,
    }),
    author: t.field({
      type: User,
      resolve: (parent: { authorId: string }) => users.find(({ id }) => id === parent.authorId)!,
    }),
  }),
});

const User = builder.objectRef<typeof users[number]>('User');

User.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    email: t.exposeString('email', {
      authz: {
        rules: ['IsAdmin'],
      },
    }),
    posts: t.field({
      type: [Post],
      resolve: (parent: { id: string }) => posts.filter(({ authorId }) => authorId === parent.id),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.field({
      type: [User],
      authz: {
        rules: ['IsAuthenticated'],
      },
      resolve: () => users,
    }),
    posts: t.field({
      type: [Post],
      resolve: () => posts,
    }),
    post: t.field({
      type: Post,
      nullable: true,
      args: {
        id: t.arg.id(),
      },
      resolve: (parent, args) => posts.find(({ id }) => id === args.id),
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    publishPost: t.field({
      type: Post,
      authz: {
        rules: ['CanPublishPost'],
      },
      args: {
        postId: t.arg.id(),
      },
      resolve: (parent, args) => {
        const post = posts.find(({ id }) => id === args.postId);
        if (!post) {
          throw new Error('Not Found');
        }

        post.status = Status.Public;

        return post;
      },
    }),
  }),
});

export default builder.toSchema();
