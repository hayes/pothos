import { createClient } from '@libsql/client';
import SchemaBuilder from '@pothos/core';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import {
  blob,
  getTableConfig,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { graphql } from 'graphql';
import DrizzlePlugin from '../src';

it.each([
  ['Buffer', false],
  ['Uint8Array', false],
  ['Buffer', true],
  ['Uint8Array', true],
] as const)('loads missing fields by %s primary keys (compound: %s)', async (binaryType, compound) => {
  const users = sqliteTable(
    'users',
    {
      id: blob({ mode: 'buffer' }).notNull(),
      version: integer().notNull(),
      name: text().notNull(),
    },
    (table) => [
      compound
        ? primaryKey({ columns: [table.id, table.version] })
        : primaryKey({ columns: [table.id] }),
    ],
  );
  const relations = defineRelations({ users });
  const client = createClient({ url: ':memory:' });

  try {
    await client.execute(
      `create table users (id blob not null, version integer not null, name text not null,
        primary key (${compound ? 'id, version' : 'id'}))`,
    );
    const db = drizzle({ client, relations });
    const rows = [
      { id: Buffer.from([255]), version: 1, name: 'Alice' },
      { id: Buffer.from([254]), version: 1, name: 'Bob' },
      ...(compound ? [{ id: Buffer.from([255]), version: 2, name: 'Carol' }] : []),
    ];
    await db.insert(users).values(rows);
    const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
      plugins: [DrizzlePlugin],
      scopeAuth: { authScopes: () => ({}) },
      drizzle: { client: db, relations, getTableConfig },
    });
    const User = builder.drizzleObject('users', {
      select: { columns: { id: true, version: true } },
      fields: (t) => ({ name: t.exposeString('name', { nullable: false }) }),
    });
    // Use fresh key objects, including a view with unrelated bytes outside its bounds.
    const parents = [...rows].reverse().map(({ id, version }) => {
      const view = new Uint8Array([0, ...id, 0]).subarray(1, 2);
      return {
        id: (binaryType === 'Buffer' ? Buffer.from(view) : view) as Buffer,
        version,
      };
    });
    builder.queryType({
      fields: (t) => ({
        users: t.field({ type: [User], resolve: () => [...parents, parents[0]] }),
      }),
    });
    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ users { name } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    const expected = [...rows].reverse().map(({ name }) => ({ name }));
    expect(result.data).toEqual({ users: [...expected, expected[0]] });
  } finally {
    client.close();
  }
});
