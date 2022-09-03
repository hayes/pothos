import { builder } from './builder';
import { Comments, IComment, IPost, IUser, Posts, Users } from './data';

export const User = builder.objectRef<IUser>('User');
export const Post = builder.objectRef<IPost>('Post');
export const Comment = builder.objectRef<IComment>('Comment');

User.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    posts: t.field({
      type: [Post],
      resolve: (user) => [...Posts.values()].filter((post) => post.authorId === user.id),
    }),
    comments: t.field({
      type: [Comment],
      resolve: (user) => [...Comments.values()].filter((comment) => comment.authorId === user.id),
    }),
  }),
});

Post.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    author: t.field({
      type: User,
      nullable: true,
      resolve: (post) => [...Users.values()].find((user) => user.id === post.authorId),
    }),
    comments: t.field({
      type: [Comment],
      resolve: (post) => [...Comments.values()].filter((comment) => comment.postId === post.id),
    }),
  }),
});

Comment.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    comment: t.exposeString('comment'),
    author: t.field({
      type: User,
      nullable: true,
      resolve: (comment) => [...Users.values()].find((user) => user.id === comment.authorId),
    }),
    post: t.field({
      type: Post,
      resolve: (comment) => [...Posts.values()].find((post) => post.id === comment.postId)!,
    }),
  }),
});

const DEFAULT_PAGE_SIZE = 10;

builder.queryType({
  fields: (t) => ({
    post: t.field({
      type: Post,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (root, args) => Posts.get(String(args.id)),
    }),
    posts: t.field({
      type: [Post],
      nullable: true,
      args: {
        take: t.arg.int(),
        skip: t.arg.int(),
      },
      resolve: (root, { skip, take }) =>
        [...Posts.values()].slice(skip ?? 0, (skip ?? 0) + (take ?? DEFAULT_PAGE_SIZE)),
    }),
    user: t.field({
      type: User,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (root, args) => Users.get(String(args.id)),
    }),
  }),
});

export const schema = builder.toSchema();
