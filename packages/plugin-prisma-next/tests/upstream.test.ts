// Upstream ORM behaviour the plugin relies on; a failure here means an ORM upgrade changed it.
import type { Collection, CollectionState } from '@prisma/orm-family-sql/orm-client';
import postgres from '@prisma/orm-postgres/runtime';
import sqlite from '@prisma/orm-sqlite/runtime';
import { describe, expect, it } from 'vitest';
import {
  createSqliteRuntime,
  loadPostgresContract,
  sampleContract,
  sampleDdl,
} from './fixtures/helpers';
import { junctionContract } from './fixtures/junction';
import type { Contract as PostgresContract } from './postgres/contract';

describe('Prisma ORM behaviour the plugin relies on', () => {
  it('rejects a combine inside a to-one include', () => {
    const { orm } = sqlite({ contract: sampleContract });
    expect(() =>
      orm.Post.include('author', (author) => {
        // @ts-expect-error the ORM also rejects to-one combines statically
        return author.combine({ rows: author.select('firstName') });
      }),
    ).toThrowError(expect.objectContaining({ code: 'ORM.INCLUDE_UNSUPPORTED' }));
  });

  it("a client's collections carry its execution context, which a transaction doesn't expose", async () => {
    const db = createSqliteRuntime(sampleContract, sampleDdl);
    try {
      await db.client.transaction((tx) => {
        expect('context' in tx).toBe(false);
        expect((tx.orm.User as unknown as { ctx: { context: unknown } }).ctx.context).toBe(
          db.client.context,
        );
        return Promise.resolve();
      });
    } finally {
      await db.cleanup();
    }
  });

  it('Collection.include() on an N:M relation keeps the cardinality and carries the `through` junction descriptor', () => {
    const { orm } = sqlite({ contract: junctionContract });
    const withTags = (orm as unknown as { Post: Collection<never, never> }).Post.include(
      'tags' as never,
    ) as unknown as { state: { includes: Record<string, unknown>[] } };
    const [inc] = withTags.state.includes;

    expect(inc).toMatchObject({
      relatedModelName: 'Tag',
      relatedTableName: 'tag',
      localColumns: ['id'],
      targetColumns: ['postId'],
      cardinality: 'N:M',
      through: {
        table: 'post_tag',
        namespaceId: '__unbound__',
        parentColumns: ['postId'],
        childColumns: ['tagId'],
        targetColumns: ['id'],
        parentLocalColumns: ['id'],
      },
    });
  });
});

it('exposes the native connection state checked before loading a page', async () => {
  // No statements are run. PostgreSQL's contract allows constructing distinctOn as well.
  const contract = loadPostgresContract<PostgresContract>(
    new URL('./postgres/contract.json', import.meta.url),
  );
  const client = postgres({ contract, url: 'postgresql://unused', verifyMarker: false });
  const state = (collection: object) => Reflect.get(collection, 'state') as CollectionState;
  try {
    const base = client.orm.public.Entry;
    expect(state(base)).toMatchObject({
      includes: [],
      orderBy: undefined,
      limit: undefined,
      offset: undefined,
      cursor: undefined,
      distinct: undefined,
      distinctOn: undefined,
    });
    expect(state(base.limit(0)).limit).toBe(0);
    expect(state(base.offset(0)).offset).toBe(0);
    expect(state(base.distinct('accountId')).distinct).toEqual(['accountId']);
    expect(state(base.include('account')).includes).toHaveLength(1);
    const ordered = base.orderBy((entry) => entry.id.asc());
    expect(state(ordered).orderBy).toHaveLength(1);
    expect(state(ordered.cursor({ id: 'e1' })).cursor).toEqual({ id: 'e1' });
    expect(state(ordered.distinctOn('id')).distinctOn).toEqual(['id']);
    expect(state(base.where({ id: 'e1' }).select('id'))).toMatchObject({
      includes: [],
      orderBy: undefined,
      selectedFields: ['id'],
    });
    expect(state(base.where({ id: 'e1' })).filters).toHaveLength(1);
  } finally {
    await client.close();
  }
});
