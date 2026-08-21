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
