import { getTableColumns } from 'drizzle-orm';
import { bigint, integer, pgTable, timestamp } from 'drizzle-orm/pg-core';
import type { PothosDrizzleSchemaConfig } from '../src/utils/config';
import { getCursorFormatter, getCursorParser } from '../src/utils/cursors';

const events = pgTable('events', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  seq: integer('seq').notNull(),
});

const columns = getTableColumns(events);

const config = {
  columnToTsName: (column) => Object.entries(columns).find(([, c]) => c === column)![0],
} as PothosDrizzleSchemaConfig;

describe('cursor values', () => {
  it('round trips a Date through a compound cursor', () => {
    const created = new Date('2026-08-19T21:50:45.086Z');
    const cursor = getCursorFormatter(
      [events.createdAt, events.seq],
      config,
    )({
      createdAt: created,
      seq: 5,
    });

    const parsed = getCursorParser(['createdAt', 'seq'])(cursor);

    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.createdAt).toEqual(created);
    expect(parsed.seq).toBe(5);
  });

  it('round trips a bigint through a compound cursor', () => {
    const cursor = getCursorFormatter(
      [events.id, events.seq],
      config,
    )({
      id: BigInt('9007199254740993'),
      seq: 5,
    });

    expect(getCursorParser(['id', 'seq'])(cursor)).toEqual({
      id: BigInt('9007199254740993'),
      seq: 5,
    });
  });

  it('round trips a null through a compound cursor', () => {
    const cursor = getCursorFormatter(
      [events.seq, events.id],
      config,
    )({ seq: null, id: BigInt(2) });

    expect(getCursorParser(['seq', 'id'])(cursor)).toEqual({ seq: null, id: BigInt(2) });
  });

  it('still reads compound cursors written before values were tagged', () => {
    // DC:J:[7,5], the format compound cursors used previously
    const legacy = Buffer.from('DC:J:[7,5]').toString('base64');

    expect(getCursorParser(['seq', 'id'])(legacy)).toEqual({ seq: 7, id: 5 });
  });

  it('rejects a cursor with no values', () => {
    const empty = Buffer.from('DC:J:[]').toString('base64');

    expect(() => getCursorParser(['seq', 'id'])(empty)).toThrow('Cursor contains no values');
  });
});

describe('composite primary keys', () => {
  it('falls back to a composite unique constraint when there is no primary key', async () => {
    const { defineRelations } = await import('drizzle-orm');
    const { getTableConfig: getPgTableConfig, unique } = await import('drizzle-orm/pg-core');
    const { default: SchemaBuilder } = await import('@pothos/core');
    const { getSchemaConfig } = await import('../src/utils/config');
    const { drizzleCursorConnectionQuery } = await import('../src/utils/cursors');
    const DrizzlePlugin = (await import('../src')).default;

    const readings = pgTable(
      'readings',
      {
        sensorId: integer('sensor_id').notNull(),
        slot: integer('slot').notNull(),
        takenAt: timestamp('taken_at'),
      },
      (t) => [unique('readings_sensor_slot').on(t.sensorId, t.slot)],
    );

    const relations = defineRelations({ readings }, () => ({}));
    const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
      plugins: [DrizzlePlugin],
      drizzle: { client: {} as never, getTableConfig: getPgTableConfig, relations },
    } as never);

    const schemaConfig = getSchemaConfig(builder as never);

    const query = drizzleCursorConnectionQuery({
      args: { first: 3 },
      ctx: {},
      orderBy: { takenAt: 'desc' },
      config: schemaConfig,
      table: schemaConfig.relations.readings,
    });

    expect(query.orderBy).toEqual({ takenAt: 'desc', sensorId: 'desc', slot: 'desc' });
  });

  it('is trusted even when its columns are not marked notNull', async () => {
    const { defineRelations } = await import('drizzle-orm');
    const { getTableConfig: getPgTableConfig, primaryKey } = await import('drizzle-orm/pg-core');
    const { default: SchemaBuilder } = await import('@pothos/core');
    const { getSchemaConfig } = await import('../src/utils/config');
    const { drizzleCursorConnectionQuery } = await import('../src/utils/cursors');
    const DrizzlePlugin = (await import('../src')).default;

    // the columns carry no .notNull(), but SQL makes primary key columns
    // non-nullable regardless
    const memberships = pgTable(
      'memberships',
      {
        userId: integer('user_id'),
        groupId: integer('group_id'),
        joinedAt: timestamp('joined_at'),
      },
      (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
    );

    const relations = defineRelations({ memberships }, () => ({}));
    const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
      plugins: [DrizzlePlugin],
      drizzle: { client: {} as never, getTableConfig: getPgTableConfig, relations },
    } as never);

    const schemaConfig = getSchemaConfig(builder as never);

    const query = drizzleCursorConnectionQuery({
      args: { first: 3 },
      ctx: {},
      orderBy: { joinedAt: 'desc' },
      config: schemaConfig,
      table: schemaConfig.relations.memberships,
    });

    expect(query.orderBy).toEqual({ joinedAt: 'desc', userId: 'desc', groupId: 'desc' });
  });

  it('appends the rest of the key on postgres, where drizzle reports it as ExtraConfigColumns', async () => {
    const { getSchemaConfig } = await import('../src/utils/config');
    const { drizzleCursorConnectionQuery } = await import('../src/utils/cursors');
    const builder = (await import('./postgres/builder')).default;

    const config = getSchemaConfig(builder as never);
    const table = config.relations.usersToGroups;

    // users_to_groups has the composite key (user_id, group_id); ordering by
    // one half has to pick up the other
    const query = drizzleCursorConnectionQuery({
      args: { first: 3 },
      ctx: {},
      orderBy: { userId: 'asc' },
      config,
      table,
    });

    expect(query.orderBy).toEqual({ userId: 'asc', groupId: 'asc' });
  });
});

describe('keyset filters', () => {
  async function whereSQLForCursor(cursorValues: { createdAt: Date | null; id: bigint }) {
    const { defineRelations } = await import('drizzle-orm');
    const { getTableConfig: getPgTableConfig } = await import('drizzle-orm/pg-core');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { default: postgres } = await import('postgres');
    const { default: SchemaBuilder } = await import('@pothos/core');
    const { getSchemaConfig } = await import('../src/utils/config');
    const { drizzleCursorConnectionQuery, getCursorFormatter } = await import(
      '../src/utils/cursors'
    );
    const DrizzlePlugin = (await import('../src')).default;

    const relations = defineRelations({ events }, () => ({}));
    const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
      plugins: [DrizzlePlugin],
      drizzle: { client: {} as never, getTableConfig: getPgTableConfig, relations },
    } as never);

    const schemaConfig = getSchemaConfig(builder as never);
    const cursor = getCursorFormatter([events.createdAt, events.id], schemaConfig)(cursorValues);

    const query = drizzleCursorConnectionQuery({
      args: { first: 3, after: cursor },
      ctx: {},
      orderBy: { createdAt: 'desc', id: 'desc' },
      config: schemaConfig,
      table: schemaConfig.relations.events,
    });

    // the filter is only as good as the SQL drizzle builds from it, so compile it
    const db = drizzle({
      client: postgres('postgresql://pothos:pothos@localhost:5455/pothos'),
      relations,
    });

    return db.query.events.findMany({ where: query.where as {} }).toSQL();
  }

  it('keeps the equality clause when the cursor value is a Date', async () => {
    const createdAt = new Date('2026-08-20T12:00:00.086Z');
    const { sql, params } = await whereSQLForCursor({ createdAt, id: BigInt(12) });

    // drizzle reads a bare Date as a nested filter and drops the clause, which
    // leaves `created_at < $1 or id < $2` -- a filter that walks rows it should
    // not, and skips rows it should return
    expect(sql).toMatch(/"created_at" < \$1.*"created_at" = \$2.*"id" < \$3/s);
    // the timestamp codec renders the Date, and both copies have to survive it
    expect(params).toEqual([createdAt.toISOString(), createdAt.toISOString(), BigInt(12)]);
  });

  it('keeps comparing against null cursor values with is null', async () => {
    const { sql } = await whereSQLForCursor({ createdAt: null, id: BigInt(12) });

    expect(sql).toMatch(/"created_at" is null.*"id" < \$/s);
  });
});
