// Upstream ORM behaviour the plugin relies on; a failure here means an ORM upgrade changed it.
import type { Collection } from '@prisma/orm-family-sql/orm-client';
import sqlite from '@prisma/orm-sqlite/runtime';
import { describe, expect, it } from 'vitest';
import { createSqliteRuntime, sampleContract, sampleDdl } from './fixtures/helpers';
import { junctionContract } from './fixtures/junction';

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
