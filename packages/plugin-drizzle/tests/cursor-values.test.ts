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
