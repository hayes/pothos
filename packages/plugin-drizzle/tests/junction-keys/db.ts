import { createClient } from '@libsql/client';
import { defineRelations, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
});
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  // The DDL gives this INTEGER column NOCASE collation and stores text in it.
  code: integer('code'),
});
export const postTags = sqliteTable('post_tags', {
  postId: integer('post_id').notNull(),
  tagId: integer('tag_id'),
  code: integer('code'),
});
export const editions = sqliteTable(
  'editions',
  {
    series: text('series').notNull(),
    number: integer('number').notNull(),
    serial: integer('serial').notNull(),
    code: text('code').notNull(),
  },
  (t) => [primaryKey({ columns: [t.series, t.number] })],
);
export const postEditions = sqliteTable('post_editions', {
  postId: integer('post_id').notNull(),
  editionSerial: integer('edition_serial'),
  editionCode: text('edition_code'),
  series: text('series'),
  number: integer('number'),
});
// Nullable unique keys cannot identify the two rows whose name is NULL.
export const labels = sqliteTable('labels', {
  name: text('name').unique(),
  code: integer('code').notNull(),
});
export const postLabels = sqliteTable('post_labels', {
  postId: integer('post_id').notNull(),
  code: integer('code'),
});
export const schema = { posts, tags, postTags, editions, postEditions, labels, postLabels };
export const relations = defineRelations(schema, (r) => ({
  posts: {
    tags: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.id.through(r.postTags.tagId),
    }),
    scopedTags: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.id.through(r.postTags.tagId),
      where: { name: 'tag 1' },
    }),
    staticRawTags: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.id.through(r.postTags.tagId),
      where: { RAW: sql`${tags.name} = 'tag 1'` },
    }),
    callbackRawTags: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.id.through(r.postTags.tagId),
      where: { RAW: (table) => sql`${table.name} = 'tag 1'` },
    }),
    numericCodes: r.many.tags({
      from: r.posts.id.through(r.postTags.postId),
      to: r.tags.code.through(r.postTags.code),
    }),
    editions: r.many.editions({
      from: r.posts.id.through(r.postEditions.postId),
      to: r.editions.serial.through(r.postEditions.editionSerial),
    }),
    editionCodes: r.many.editions({
      from: r.posts.id.through(r.postEditions.postId),
      to: r.editions.code.through(r.postEditions.editionCode),
    }),
    editionSlots: r.many.editions({
      from: r.posts.id.through(r.postEditions.postId),
      to: [
        r.editions.series.through(r.postEditions.series),
        r.editions.number.through(r.postEditions.number),
      ],
    }),
    labels: r.many.labels({
      from: r.posts.id.through(r.postLabels.postId),
      to: r.labels.code.through(r.postLabels.code),
    }),
  },
  tags: {},
  editions: {},
  labels: {},
}));
export const client = createClient({ url: ':memory:' });
export const db = drizzle({ client, relations });
export type DrizzleRelations = typeof relations;
export const POST_ID = 1;
export const TAG_COUNT = 200;
export const EDITION_COUNT = 5;

export async function seed() {
  await client.executeMultiple(`
    create table posts (id integer primary key);
    create table tags (id integer primary key, name text not null, code integer collate nocase);
    create table post_tags (post_id integer not null, tag_id integer, code integer);
    create index post_tags_parent on post_tags (post_id, tag_id);
    create table editions (
      series text collate nocase not null, number integer not null, serial integer not null, code text not null,
      primary key (series, number)
    );
    create index editions_serial on editions (serial);
    create index editions_code on editions (code);
    create table post_editions (
      post_id integer not null, edition_serial integer, edition_code text, series text, number integer
    );
    create index post_editions_parent on post_editions (post_id);
    create table labels (name text unique, code integer not null);
    create table post_labels (post_id integer not null, code integer);
  `);
  await db.insert(posts).values([{ id: POST_ID }, { id: 2 }, { id: 3 }]);
  await db
    .insert(tags)
    .values(Array.from({ length: TAG_COUNT }, (_, i) => ({ id: i + 1, name: `tag ${i + 1}` })));
  await db.insert(postTags).values([
    { postId: POST_ID, tagId: 1 },
    { postId: POST_ID, tagId: 1 },
    { postId: POST_ID, tagId: 2 },
    { postId: POST_ID, tagId: null },
    { postId: POST_ID, tagId: 999 },
    { postId: 2, tagId: 3 },
  ]);
  // Bypass the TypeScript number type: legal SQLite values must retain join semantics.
  await client.executeMultiple(`
    update tags set code = 'A' where id = 1;
    update tags set code = 'B' where id = 2;
    update post_tags set code = 'a' where tag_id = 1;
    update post_tags set code = 'B' where tag_id = 2;
    insert into labels values (null, 1), (null, 1), ('other', 2);
    insert into post_labels values (1, 1);
  `);
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
    // The target's NOCASE collation must not override the junction's binary comparison.
    { postId: POST_ID, editionSerial: null, editionCode: null, series: 'A', number: 3 },
    { postId: 2, editionSerial: 13, editionCode: 'a3', series: 'a', number: 3 },
  ]);
  await client.execute('analyze');
}
