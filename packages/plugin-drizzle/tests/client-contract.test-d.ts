import { expectTypeOf, it } from 'vitest';
import type { DrizzleClient } from '../src';
import { db as sqlite } from './example/db';
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
