import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
    roleIdIdx: index('user_roles_role_id_idx').on(t.roleId),
  }),
);

export const userProfile = sqliteTable(
  'profile',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bio: text('bio'),
  },
  (t) => ({
    userIdIdx: index('profile_user_id_idx').on(t.userId),
  }),
);

export const posts = sqliteTable(
  'posts',
  {
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
  },
  (t) => ({
    authorIdIdx: index('posts_author_id_idx').on(t.authorId),
    categoryIdIdx: index('posts_category_id_idx').on(t.categoryId),
  }),
);

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
    userIdIdx: index('post_likes_user_id_idx').on(t.userId),
  }),
);

export const comments = sqliteTable(
  'comments',
  {
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
  },
  (t) => ({
    authorIdIdx: index('comments_author_id_idx').on(t.authorId),
    postIdIdx: index('comments_post_id_idx').on(t.postId),
  }),
);

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});
