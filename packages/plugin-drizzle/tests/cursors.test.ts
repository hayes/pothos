import { getColumns, type TableRelationalConfig } from 'drizzle-orm';
import { integer, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { PothosDrizzleSchemaConfig } from '../src/utils/config';
import {
  drizzleCursorConnectionQuery,
  getCursorFormatter,
} from '../src/utils/cursors';

const posts = pgTable('posts', {
  id: integer('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

const table = { table: posts } as unknown as TableRelationalConfig;

const columns = getColumns(posts);

const config: PothosDrizzleSchemaConfig = {
  skipDeferredFragments: true,
  relations: {},
  getPrimaryKey: () => [posts.id],
  columnToTsName: (column) => {
    for (const [tsName, col] of Object.entries(columns)) {
      if (col === column) {
        return tsName;
      }
    }
    throw new Error(`no ts name for ${String(column.name)}`);
  },
};

const formatter = getCursorFormatter([posts.createdAt, posts.id], config);
const stored = new Date('2026-08-19T21:50:45.086Z');
const cursor = formatter({ createdAt: stored, id: 1018 });

describe('drizzleCursorConnectionQuery identity exclusivity', () => {
  it('last/before must exclude the cursor row by id when orderBy is a Date plus id', () => {
    const result = drizzleCursorConnectionQuery({
      args: { last: 2, before: cursor },
      ctx: {},
      orderBy: { createdAt: 'desc', id: 'desc' },
      config,
      table,
    });

    expect(result.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ id: { ne: 1018 } }]),
      }),
    );
  });

  it('first/after must exclude the cursor row by id when orderBy is a Date plus id', () => {
    const result = drizzleCursorConnectionQuery({
      args: { first: 2, after: cursor },
      ctx: {},
      orderBy: { createdAt: 'desc', id: 'desc' },
      config,
      table,
    });

    expect(result.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ id: { ne: 1018 } }]),
      }),
    );
  });
});
