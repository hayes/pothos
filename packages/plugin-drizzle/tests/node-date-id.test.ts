import { createClient } from '@libsql/client';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { getTableConfig, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { graphql } from 'graphql';
import DrizzlePlugin from '../src';

it('loads and batches nodes by Date IDs with distinct milliseconds', async () => {
  const client = createClient({ url: ':memory:' });

  try {
    const events = sqliteTable('events', {
      id: integer().primaryKey(),
      at: integer({ mode: 'timestamp_ms' }).notNull().unique(),
    });
    const relations = defineRelations({ events });
    const db = drizzle({ client, relations });

    await client.execute(
      'create table events (id integer primary key, at integer not null unique)',
    );
    await db.insert(events).values([
      { id: 1, at: new Date('2025-01-01T00:00:00.123Z') },
      { id: 2, at: new Date('2025-01-01T00:00:00.124Z') },
    ]);

    const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
      plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
      drizzle: { client: db, relations, getTableConfig },
      scopeAuth: { authScopes: () => ({}) },
    });

    builder.drizzleNode('events', {
      name: 'Event',
      id: { column: events.at },
      fields: (t) => ({ key: t.exposeInt('id') }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

    const firstID = Buffer.from('Event:1735689600123').toString('base64');
    const secondID = Buffer.from('Event:1735689600124').toString('base64');
    const result = await graphql({
      schema: builder.toSchema(),
      source: `query($ids: [ID!]!) {
        nodes(ids: $ids) {
          id
          ... on Event { key }
        }
      }`,
      variableValues: { ids: [secondID, firstID, secondID] },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      nodes: [
        { id: secondID, key: 2 },
        { id: firstID, key: 1 },
        { id: secondID, key: 2 },
      ],
    });
  } finally {
    client.close();
  }
});
