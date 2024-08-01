import { builder } from './builder';
import { Comments, Posts, Users } from './data';
import type { IComment, IPost, IUser, PageCursor, PageCursors } from './types';
import { resolveWindowedConnection } from './util';

export const User = builder.objectRef<IUser>('User');
export const Post = builder.objectRef<IPost>('Post');
export const Comment = builder.objectRef<IComment>('Comment');

const PageCursorRef = builder.objectRef<PageCursor>('PageCursor');

const PageCursorsRef = builder.objectRef<PageCursors>('PageCursors');

PageCursorsRef.implement({
  fields: (t) => ({
    first: t.field({
      type: PageCursorRef,
      resolve: ({ first }) => first,
    }),
    last: t.field({
      type: PageCursorRef,
      resolve: ({ last }) => last,
    }),
    around: t.field({
      type: [PageCursorRef],
      resolve: ({ around }) => around,
    }),
  }),
});

PageCursorRef.implement({
  fields: (t) => ({
    cursor: t.exposeString('cursor'),
    pageNumber: t.exposeInt('pageNumber'),
    isCurrent: t.exposeBoolean('isCurrent'),
  }),
});

builder.globalConnectionField('pageCursors', (t) =>
  t.field({
    type: PageCursorsRef,
    resolve: ({ pageCursors }) => pageCursors,
  }),
);

builder.node(User, {
  id: {
    resolve: (user) => user.id,
  },
  loadMany: (ids) => ids.map((id) => Users.get(id)),
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    posts: t.connection({
      type: Post,
      resolve: (user, args) =>
        resolveWindowedConnection({ args }, ({ limit, offset }) => {
          const posts = [...Posts.values()].filter((post) => post.authorId === user.id);

          return {
            items: posts.slice(offset, offset + limit),
            totalCount: posts.length,
          };
        }),
    }),
    comments: t.connection({
      type: Comment,
      resolve: (user, args) =>
        resolveWindowedConnection({ args }, ({ limit, offset }) => {
          const comments = [...Comments.values()].filter((comment) => comment.authorId === user.id);

          return {
            items: comments.slice(offset, offset + limit),
            totalCount: comments.length,
          };
        }),
    }),
  }),
});

builder.node(Post, {
  id: {
    resolve: (post) => post.id,
  },
  loadMany: (ids) => ids.map((id) => Posts.get(id)),
  fields: (t) => ({
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    author: t.field({
      type: User,
      nullable: true,
      resolve: (post) => Users.get(post.id),
    }),
    comments: t.connection({
      type: Comment,
      resolve: (post, args) =>
        resolveWindowedConnection({ args }, ({ limit, offset }) => {
          const comments = [...Comments.values()].filter((comment) => comment.postId === post.id);

          return {
            items: comments.slice(offset, offset + limit),
            totalCount: comments.length,
          };
        }),
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
      resolve: (comment) => Users.get(comment.id),
    }),
    post: t.field({
      type: Post,
      resolve: (comment) => Posts.get(comment.id)!,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    post: t.field({
      type: Post,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_root, args) => Posts.get(String(args.id)),
    }),
    posts: t.connection({
      type: Post,
      resolve: (_root, args) =>
        resolveWindowedConnection({ args }, ({ limit, offset }) => ({
          items: [...Posts.values()].slice(offset, offset + limit),
          totalCount: Posts.size,
        })),
    }),
    user: t.field({
      type: User,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_root, args) => Users.get(String(args.id)),
    }),
  }),
});

export const schema = builder.toSchema();
