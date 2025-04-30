import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    comments: r.many.comments({
      from: r.posts.id,
      to: r.comments.id,
    }),
    commenters: r.many.users({
      from: r.posts.id.through(r.comments.postId),
      to: r.users.id.through(r.comments.authorId),
    }),
    likes: r.many.users({
      from: r.posts.id.through(r.postLikes.postId),
      to: r.users.id.through(r.postLikes.userId),
    }),
    category: r.one.categories(),
  },
  users: {
    posts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
    }),
    likedPosts: r.many.posts({
      from: r.users.id.through(r.postLikes.userId),
      to: r.posts.id.through(r.postLikes.postId),
    }),
    profile: r.one.profile({
      from: r.users.id,
      to: r.profile.userId,
    }),
    roles: r.many.roles(),
    comments: r.many.comments({
      from: r.users.id,
      to: r.comments.authorId,
    }),
    userRoles: r.many.userRoles({
      from: r.users.id,
      to: r.userRoles.userId,
    }),
  },
  categories: {
    posts: r.many.posts({
      from: r.categories.id,
      to: r.posts.categoryId,
    }),
  },
  profile: {
    user: r.one.users({}),
  },
  roles: {
    users: r.many.users({
      from: r.roles.id.through(r.userRoles.roleId),
      to: r.users.id.through(r.userRoles.userId),
    }),
    userRoles: r.many.userRoles({
      from: r.roles.id,
      to: r.userRoles.roleId,
    }),
  },
  userRoles: {
    role: r.one.roles({}),
    user: r.one.users({}),
  },
  comments: {
    author: r.one.users(),
    post: r.one.posts(),
  },
}));
