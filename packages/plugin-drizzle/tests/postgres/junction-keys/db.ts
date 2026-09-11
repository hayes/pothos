import { defineRelations } from 'drizzle-orm';
import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { queryClient } from '../db';

export const posts = pgTable('jk_posts', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
});

export const tags = pgTable('jk_tags', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const postTags = pgTable('jk_post_tags', {
  postId: integer('post_id').notNull(),
  tagId: integer('tag_id'),
});

export const editions = pgTable(
  'jk_editions',
  {
    series: text('series').notNull(),
    number: integer('number').notNull(),
    serial: integer('serial').notNull(),
    code: text('code').notNull(),
  },
  (t) => [primaryKey({ columns: [t.series, t.number] })],
);

export const postEditions = pgTable('jk_post_editions', {
  postId: integer('post_id').notNull(),
  editionSerial: integer('edition_serial'),
  editionCode: text('edition_code'),
  series: text('series'),
  number: integer('number'),
});

export const schema = { posts, tags, postTags, editions, postEditions };

export const relations = defineRelations(schema, (r) => ({
  posts: {
    tags: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.id.through(r.postTags.tagId),
    }),
    scopedTags: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.id.through(r.postTags.tagId),
      where: { name: 'tag 2' },
    }),
    editions: r.many.editions({
      from: r.posts.id.through(r.postEditions.postId),
      to: r.editions.serial.through(r.postEditions.editionSerial),
    }),
    editionCodes: r.many.editions({
      alias: 'editionCodes',
      from: r.posts.id.through(r.postEditions.postId),
      to: r.editions.code.through(r.postEditions.editionCode),
    }),
    editionSlots: r.many.editions({
      alias: 'editionSlots',
      from: r.posts.id.through(r.postEditions.postId),
      to: [
        r.editions.series.through(r.postEditions.series),
        r.editions.number.through(r.postEditions.number),
      ],
    }),
  },
  tags: {},
  editions: {},
}));

export const db = drizzle({ client: queryClient, relations });

export type DrizzleRelations = typeof relations;

export const POST_ID = 1;
export const TAG_COUNT = 20;
export const EDITION_COUNT = 5;

export async function seed() {
  await queryClient.unsafe(`
    drop table if exists jk_posts, jk_tags, jk_post_tags, jk_editions, jk_post_editions;
    create table if not exists jk_posts (id integer primary key, title text not null);
    create table if not exists jk_tags (id integer primary key, name text not null);
    create table if not exists jk_post_tags (post_id integer not null, tag_id integer);
    create table if not exists jk_editions (
      series text not null,
      number integer not null,
      serial integer not null unique,
      code text not null unique,
      primary key (series, number)
    );
    create table if not exists jk_post_editions (
      post_id integer not null,
      edition_serial integer,
      edition_code text,
      series text,
      number integer
    );
  `);

  await db.insert(posts).values([
    { id: POST_ID, title: 'the post under test' },
    { id: 2, title: 'another post' },
  ]);

  await db.insert(tags).values(
    Array.from({ length: TAG_COUNT }, (_, index) => ({
      id: index + 1,
      name: `tag ${index + 1}`,
    })),
  );

  await db.insert(postTags).values([
    { postId: POST_ID, tagId: 1 },
    { postId: POST_ID, tagId: null },
    { postId: 2, tagId: 2 },
  ]);

  await db.insert(editions).values([
    { series: 'a', number: 1, serial: 11, code: 'a1' },
    { series: 'a', number: 2, serial: 12, code: 'a2' },
    { series: 'a', number: 3, serial: 13, code: 'a3' },
    { series: 'b', number: 1, serial: 21, code: 'b1' },
    { series: 'b', number: 2, serial: 22, code: 'b2' },
  ]);

  await db.insert(postEditions).values([
    { postId: POST_ID, editionSerial: 11, editionCode: 'a1', series: 'a', number: 1 },
    { postId: POST_ID, editionSerial: 12, editionCode: 'a2', series: null, number: null },
    { postId: POST_ID, editionSerial: null, editionCode: null, series: 'b', number: 1 },
    { postId: 2, editionSerial: 13, editionCode: 'a3', series: 'a', number: 3 },
  ]);
}
