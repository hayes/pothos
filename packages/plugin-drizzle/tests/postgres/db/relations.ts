import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  posts: {
    commenters: r.many.users({
      from: r.posts.id.through(r.comments.postId),
      to: r.users.id.through(r.comments.authorId),
    }),
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    comments: r.many.comments({
      from: r.posts.id,
      to: r.comments.id,
    }),
  },
  comments: {
    post: r.one.posts({
      from: r.comments.postId,
      to: r.posts.id,
    }),
    author: r.one.users({
      from: r.comments.authorId,
      to: r.users.id,
    }),
  },
  users: {
    posts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
    }),
    profile: r.one.profileInfo({
      from: r.users.id,
      to: r.profileInfo.userId,
    }),
    invitee: r.one.users({
      from: r.users.invitedBy,
      to: r.users.id,
    }),
    groups: r.many.groups({
      from: r.users.id.through(r.usersToGroups.userId),
      to: r.groups.id.through(r.usersToGroups.groupId),
    }),
  },
  profile: {
    user: r.one.users({
      from: r.profileInfo.userId,
      to: r.users.id,
    }),
  },
}));
