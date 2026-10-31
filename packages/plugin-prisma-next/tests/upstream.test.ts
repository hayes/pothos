// Upstream ORM behavior the plugin relies on; a failure here means an ORM upgrade changed it.
import { Collection } from '@prisma/orm-family-sql/orm-client';
import sqlite from '@prisma/orm-sqlite/runtime';
import { describe, expect, it } from 'vitest';
import { createSqliteRuntime, sampleContract, sampleDdl } from './fixtures/helpers';

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
    const NS = '__unbound__';
    // The junction table must exist under `storage.namespaces.<ns>.entries.table`, otherwise the
    // `through` descriptor is silently dropped.
    const contract = {
      target: 'sqlite' as const,
      targetFamily: 'sql' as const,
      capabilities: { sql: {}, sqlite: {} },
      domain: {
        namespaces: {
          [NS]: {
            models: {
              User: {
                fields: {
                  id: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/integer@1' } },
                },
                relations: {
                  tags: {
                    to: { namespace: NS, model: 'Tag' },
                    cardinality: 'N:M', // what `rel.manyToMany` emits
                    on: {
                      localFields: ['id'],
                      targetFields: ['id'],
                    },
                    through: {
                      table: 'user_tag',
                      namespaceId: NS,
                      parentColumns: ['userId'], // junction FK → User
                      childColumns: ['tagId'], // junction FK → Tag
                      targetColumns: ['id'], // Tag PK referenced by childColumns
                    },
                  },
                },
                storage: { table: 'user', fields: { id: { column: 'id' } } },
              },
              Tag: {
                fields: {
                  id: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/integer@1' } },
                  name: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/text@1' } },
                },
                relations: {},
                storage: {
                  table: 'tag',
                  fields: { id: { column: 'id' }, name: { column: 'name' } },
                },
              },
            },
          },
        },
      },
      storage: {
        namespaces: {
          [NS]: {
            entries: {
              table: {
                user: {
                  columns: { id: { nullable: false } },
                  primaryKey: { columns: ['id'] },
                },
                tag: {
                  columns: { id: { nullable: false }, name: { nullable: false } },
                  primaryKey: { columns: ['id'] },
                },
                user_tag: {
                  columns: { userId: { nullable: false }, tagId: { nullable: false } },
                  primaryKey: { columns: ['userId', 'tagId'] },
                },
              },
            },
          },
        },
        storageHash: 'sha256:test',
      },
    } as never;

    const fakeRuntime = {} as never;
    const ctx = {
      context: { contract, runtime: fakeRuntime, scope: {}, aggregateDescriptors: new Map() },
    } as never;

    const users = new Collection(ctx, 'User' as never, { namespaceId: NS } as never);
    const withTags = users.include('tags' as never) as unknown as {
      state: { includes: unknown[] };
    };
    const inc = withTags.state.includes[0] as Record<string, unknown>;

    expect(inc.relatedModelName).toBe('Tag');
    expect(inc.relatedTableName).toBe('tag');
    expect(inc.localColumns).toEqual(['id']);
    expect(inc.targetColumns).toEqual(['id']);

    expect(inc.cardinality).toBe('N:M');
    const through = inc.through as Record<string, unknown> | undefined;
    expect(through).toBeDefined();
    expect(through).toMatchObject({
      table: 'user_tag',
      namespaceId: NS,
      parentColumns: ['userId'],
      childColumns: ['tagId'],
      targetColumns: ['id'],
      parentLocalColumns: ['id'],
    });
  });
});
