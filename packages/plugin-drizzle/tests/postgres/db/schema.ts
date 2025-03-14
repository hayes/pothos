import { integer, pgTable, primaryKey, serial, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  invitedBy: integer('invited_by'),
});

export const profileInfo = pgTable('profile_info', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  metadata: text('metadata'),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  content: text('content'),
  authorId: integer('author_id'),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  text: text('text'),
  authorId: integer('author_id'),
  postId: integer('post_id'),
});

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name'),
});

export const usersToGroups = pgTable(
  'users_to_groups',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);
