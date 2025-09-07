import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
});

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const userRoles = sqliteTable(
  'user_roles',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
  }),
);

export const userProfile = sqliteTable('profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
});

export const posts = sqliteTable('posts', {
  postId: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: integer('published').notNull().default(0),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),
  categoryId: integer('category_id').references(() => categories.id),
  createdAt: text('createdAt').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('createdAt').notNull().default(sql`(current_timestamp)`),
});

export const postLikes = sqliteTable(
  'post_likes',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.postId, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.userId] }),
  }),
);

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.postId, { onDelete: 'cascade' }),
  createdAt: text('createdAt').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('createdAt').notNull().default(sql`(current_timestamp)`),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});
