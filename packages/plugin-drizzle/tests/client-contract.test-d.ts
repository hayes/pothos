import SchemaBuilder from '@pothos/core';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin, { type DrizzleClient } from '../src';
import { relations, db as sqlite } from './example/db';
import { db as postgres } from './postgres/db';

it('accepts SQLite and PostgreSQL clients without erasing required capabilities', () => {
  expectTypeOf(sqlite).toExtend<DrizzleClient>();
  expectTypeOf(postgres).toExtend<DrizzleClient<Parameters<typeof postgres.$count>[0]>>();
});

it('rejects wrappers missing methods used by the plugin', () => {
  const client: DrizzleClient = {
    _: sqlite._,
    query: sqlite.query,
    $count: (source, filter) => sqlite.$count(source, filter),
    select: (fields) => sqlite.select(fields),
  };
  const { select: _select, ...withoutSelect } = client;
  // @ts-expect-error Relation predicates and counts require core SQL construction.
  const missingSelect: DrizzleClient = withoutSelect;
  // @ts-expect-error The model loader requires findMany for each configured table.
  const missingFindMany: DrizzleClient = { ...client, query: { users: {} } };
  expectTypeOf(missingSelect).toEqualTypeOf<DrizzleClient>();
  expectTypeOf(missingFindMany).toEqualTypeOf<DrizzleClient>();
});

it('rejects a client option that is not a client for the configured relations', () => {
  const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
    plugins: [DrizzlePlugin],
    scopeAuth: { authScopes: () => ({}) },
    drizzle: { client: sqlite, getTableConfig, relations },
  });
  type ClientOption = typeof builder.options.drizzle.client;
  type Client = Exclude<ClientOption, (...args: never[]) => unknown>;

  // @ts-expect-error A PostgreSQL client cannot count or select from SQLite tables.
  const postgresClient: Client = postgres;
  // @ts-expect-error The model loader requires findMany for each configured table.
  const missingFindMany: Client = { ...sqlite, query: { users: {} } };
  // @ts-expect-error Not a drizzle client.
  const notAClient: Client = { query: {} };
  // @ts-expect-error A client factory must return a drizzle client.
  const wrongFactory: ClientOption = () => ({ ...sqlite, query: { users: {} } });

  expectTypeOf(postgresClient).toEqualTypeOf<Client>();
  expectTypeOf(missingFindMany).toEqualTypeOf<Client>();
  expectTypeOf(notAClient).toEqualTypeOf<Client>();
  expectTypeOf(wrongFactory).toEqualTypeOf<ClientOption>();
  expectTypeOf(sqlite).toExtend<Client>();
  expectTypeOf(() => sqlite).toExtend<ClientOption>();
});
