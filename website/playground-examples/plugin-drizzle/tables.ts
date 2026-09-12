// #region tables
import { defineRelations } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer().primaryKey(),
  firstName: text().notNull(),
  lastName: text().notNull(),
  email: text().notNull().unique(),
  role: text({ enum: ['editor', 'author'] }).notNull(),
});
export const profiles = sqliteTable('profiles', {
  id: integer().primaryKey(),
  userId: integer()
    .notNull()
    .unique()
    .references(() => users.id),
  bio: text(),
});
export const posts = sqliteTable('posts', {
  id: integer().primaryKey(),
  authorId: integer()
    .notNull()
    .references(() => users.id),
  title: text().notNull(),
  content: text().notNull(),
  published: integer({ mode: 'boolean' }).notNull(),
  createdAt: text().notNull(),
});
export const media = sqliteTable('media', {
  id: integer().primaryKey(),
  url: text().notNull(),
  uploadedById: integer()
    .notNull()
    .references(() => users.id),
});
export const postMedia = sqliteTable(
  'postMedia',
  {
    caption: text(),
    id: integer().primaryKey(),
    postId: integer()
      .notNull()
      .references(() => posts.id),
    mediaId: integer()
      .notNull()
      .references(() => media.id),
  },
  (table) => [unique().on(table.postId, table.mediaId)],
);
// #endregion tables

// #region relations
export const relations = defineRelations({ users, profiles, posts, media, postMedia }, (r) => ({
  users: {
    profile: r.one.profiles({ from: r.users.id, to: r.profiles.userId }),
    posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }),
  },
  profiles: { user: r.one.users({ from: r.profiles.userId, to: r.users.id, optional: false }) },
  posts: {
    attachments: r.many.postMedia({ from: r.posts.id, to: r.postMedia.postId }),
    author: r.one.users({ from: r.posts.authorId, to: r.users.id, optional: false }),
    media: r.many.media({
      from: r.posts.id.through(r.postMedia.postId),
      to: r.media.id.through(r.postMedia.mediaId),
    }),
  },
  postMedia: {
    media: r.one.media({ from: r.postMedia.mediaId, to: r.media.id, optional: false }),
  },
  media: {
    uploadedBy: r.one.users({ from: r.media.uploadedById, to: r.users.id, optional: false }),
  },
}));
// #endregion relations
