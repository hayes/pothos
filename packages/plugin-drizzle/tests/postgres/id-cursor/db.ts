import { defineRelations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { queryClient } from '../db';

// Tables of `postgres-id-cursor-validation.test.ts` alone, so it shares no rows with another file.

export const mood = pgEnum('idc_mood', ['happy', 'sad', 'calm']);

export const owners = pgTable('idc_owners', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

// One ordering column per type. Every one is not null: a nullable ordering column loses rows.
export const items = pgTable('idc_items', {
  id: integer('id').primaryKey(),
  ownerId: integer('owner_id').notNull(),
  uid: uuid('uid').notNull().unique(),
  bigNum: bigint('big_num', { mode: 'number' }).notNull(),
  bigBig: bigint('big_big', { mode: 'bigint' }).notNull().unique(),
  ts: timestamp('ts', { mode: 'date' }).notNull(),
  tsString: timestamp('ts_string', { mode: 'string' }).notNull(),
  tsz: timestamp('tsz', { mode: 'date', withTimezone: true }).notNull(),
  tszString: timestamp('tsz_string', { mode: 'string', withTimezone: true }).notNull(),
  day: date('day').notNull(),
  amount: numeric('amount').notNull(),
  score: doublePrecision('score').notNull(),
  flag: boolean('flag').notNull(),
  label: text('label').notNull(),
  mood: mood('mood').notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  tags: integer('tags').array().notNull(),
});

export const relations = defineRelations({ owners, items }, (r) => ({
  owners: {
    items: r.many.items({ from: r.owners.id, to: r.items.ownerId }),
  },
  items: {
    owner: r.one.owners({ from: r.items.ownerId, to: r.owners.id, optional: false }),
  },
}));

export const db = drizzle({ client: queryClient, relations });

export type DrizzleRelations = typeof relations;

/** The owner whose items both connections page. */
export const OWNER_ID = 1;
/** Items of `OWNER_ID`. */
export const ITEM_COUNT = 6;

export async function seed() {
  await queryClient.unsafe(`
    do $$ begin
      create type idc_mood as enum ('happy', 'sad', 'calm');
    exception
      when duplicate_object then null;
    end $$;
    create table if not exists idc_owners (id integer primary key, name text not null);
    create table if not exists idc_items (
      id integer primary key,
      owner_id integer not null,
      uid uuid not null unique,
      big_num bigint not null,
      big_big bigint not null unique,
      ts timestamp not null,
      ts_string timestamp not null,
      tsz timestamptz not null,
      tsz_string timestamptz not null,
      day date not null,
      amount numeric not null,
      score double precision not null,
      flag boolean not null,
      label text not null,
      mood idc_mood not null,
      code varchar(20) not null,
      tags integer[] not null
    );
    delete from idc_items;
    delete from idc_owners;
    insert into idc_owners (id, name) values (1, 'one'), (2, 'two');
    insert into idc_items (
      id, owner_id, uid, big_num, big_big, ts, ts_string, tsz, tsz_string, day, amount, score,
      flag, label, mood, code, tags
    ) values
      (1, 1, 'c0000000-0000-4000-8000-000000000001', 5, 9223372036854775807,
        '2024-01-02 00:00:00.123', '2024-01-02 00:00:00.123456',
        '2024-01-02 00:00:00.123+00', '2024-01-02 00:00:00.123456+00', '2024-01-02',
        1.50, 1.5, true, 'b', 'sad', 'x-3', '{2}'),
      (2, 1, 'a0000000-0000-4000-8000-000000000002', 3, -9223372036854775808,
        '2024-01-01 00:00:00', '2024-01-01 00:00:00.000001',
        '2024-01-01 05:00:00-05', '2024-01-01 05:00:00.5-05', '2024-01-01',
        10.00, 'NaN', false, 'a', 'happy', 'x-1', '{1,5}'),
      (3, 1, 'f0000000-0000-4000-8000-000000000003', 5, 9007199254740993,
        '2024-01-02 00:00:00.123', '2024-01-02 00:00:00.123456',
        '2024-01-02 00:00:00.123+00', '2024-01-02 00:00:00.123456+00', '2024-01-02',
        2.25, -0.5, true, 'b', 'calm', 'x-10', '{1}'),
      (4, 1, 'b0000000-0000-4000-8000-000000000004', 9007199254740991, 1,
        '2023-12-31 23:59:59.999', '2023-12-31 23:59:59.999999',
        '2023-12-31 23:59:59.999+00', '2023-12-31 23:59:59.999999+00', '2023-12-31',
        1.5, 1.5, false, 'c', 'sad', 'x-2', '{3,0}'),
      (5, 1, '0a000000-0000-4000-8000-000000000005', -2, 42,
        '2024-06-01 12:00:00', '2024-06-01 12:00:00',
        '2024-06-01 12:00:00+00', '2024-06-01 12:00:00+02', '2024-06-01',
        -3.1, 'NaN', true, 'a', 'happy', 'X-0', '{1,5,0}'),
      (6, 1, 'e0000000-0000-4000-8000-000000000006', 3, -7,
        '2024-01-01 00:00:00', '2024-01-01 00:00:00.000001',
        '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00', '2024-01-01',
        0.001, '-Infinity', false, 'd', 'calm', 'y', '{10}'),
      (7, 2, 'd0000000-0000-4000-8000-000000000007', 1, 100,
        '2024-02-01 00:00:00', '2024-02-01 00:00:00',
        '2024-02-01 00:00:00+00', '2024-02-01 00:00:00+00', '2024-02-01',
        7, 'Infinity', true, 'e', 'sad', 'z', '{7}'),
      (8, 2, '10000000-0000-4000-8000-000000000008', 2, 200,
        '2024-02-02 00:00:00', '2024-02-02 00:00:00',
        '2024-02-02 00:00:00+00', '2024-02-02 00:00:00+00', '2024-02-02',
        8, 0, false, 'f', 'happy', 'z', '{8}');
  `);
}

export async function drop() {
  await queryClient.unsafe(`
    drop table if exists idc_items, idc_owners;
    drop type if exists idc_mood;
  `);
}
