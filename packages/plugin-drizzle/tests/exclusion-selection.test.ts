import { createClient } from '@libsql/client';
import SchemaBuilder from '@pothos/core';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { getTableConfig, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { graphql } from 'graphql';
import DrizzlePlugin from '../src';

it.each([
  { secret: false as const },
  { secret: false as const, id: undefined },
  { secret: false as const, name: true as const },
])('loads selected columns for %j', async (columns) => {
  const users = sqliteTable('users', {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    secret: text('secret').notNull(),
  });
  const relations = defineRelations({ users });
  const client = createClient({ url: ':memory:' });
  try {
    await client.execute('CREATE TABLE users(id integer primary key, name text, secret text)');
    await client.execute("INSERT INTO users VALUES(1, 'Alice', 'hidden')");
    const db = drizzle({ client, relations });
    const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
      plugins: [DrizzlePlugin],
      scopeAuth: { authScopes: {} },
      drizzle: { client: db, getTableConfig },
    });
    const User = builder.drizzleObject('users', {
      select: { columns },
      fields: (t) => ({ name: t.string({ nullable: false, resolve: (user) => user.name }) }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.drizzleField({
          type: User,
          resolve: (query) => db.query.users.findFirst(query()),
        }),
      }),
    });
    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ user { name } }',
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { name: 'Alice' } });
  } finally {
    client.close();
  }
});
