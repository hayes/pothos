import { createClient } from '@libsql/client';
import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { getTableConfig, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { drizzleAdapter } from '../src/utils/adapter';
import { getSchemaConfig } from '../src/utils/config';

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  nickname: text('nickname'),
});

const relations = defineRelations({ users });
const client = createClient({ url: ':memory:' });
const db = drizzle({ client, relations });

const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
  plugins: [DrizzlePlugin],
  scopeAuth: { authScopes: () => ({}) },
  drizzle: { client: db, relations, getTableConfig },
});

const config = getSchemaConfig(builder);
const adapter = drizzleAdapter(config);

beforeAll(async () => {
  await client.execute(
    'create table users (id integer primary key, name text not null, nickname text)',
  );
  await db.insert(users).values({ id: 1, name: 'Maya', nickname: 'M' });
});

afterAll(() => {
  client.close();
});

// `columns: { id: false }` is drizzle's exclusion form: every column but `id`. Recording
// nothing for it leaves the query selecting only the primary key.
describe('exclusion column selections', () => {
  it('expands a columns selection with only false entries to the other columns', () => {
    const node = adapter.createNode(config.relations.users);

    adapter.mergeQuery(node, { columns: { id: false } });

    expect(node.columns).toEqual(new Set(['name', 'nickname']));
  });

  it('loads the excluded selection`s other columns from the database', async () => {
    const direct = await db.query.users.findMany({ columns: { id: false } });

    const node = adapter.createNode(config.relations.users);
    adapter.mergeQuery(node, { columns: { id: false } });

    const result = await db.query.users.findMany(adapter.toQuery(node) as never);

    expect(result[0].name).toBe(direct[0].name);
    expect(result[0].nickname).toBe(direct[0].nickname);
  });

  it('keeps a selection that names any column an inclusion', () => {
    const node = adapter.createNode(config.relations.users);

    adapter.mergeQuery(node, { columns: { name: true, nickname: false } });

    expect(node.columns).toEqual(new Set(['name']));
  });

  it('resolves fields promised by an exclusion type selection', async () => {
    builder.drizzleObject('users', {
      select: { columns: { id: false } },
      fields: (t) => ({
        name: t.string({ resolve: (parent) => parent.name }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        users: t.drizzleField({
          type: ['users'],
          resolve: (query) => db.query.users.findMany(query()),
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: gql`
        query {
          users {
            name
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ name: 'Maya' }] });
  });
});
