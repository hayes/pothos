/**
 * Upstream canary: pins prisma-next's current M:N support state so the
 * day they fix it, this test fails loudly and we know to flip the
 * plugin's M:N rejection in `buildRelationMeta` to a working
 * `localFields`-from-junction implementation.
 *
 * Evidence captured here was the basis for the plugin's schema-build
 * M:N throw. Cross-references in prisma-next:
 *
 *   - packages/2-sql/2-authoring/contract-psl/README.md (PSL docs):
 *     "Implicit Prisma ORM many-to-many remains unsupported (list
 *     navigation on both sides without explicit join model)"
 *
 *   - examples/pothos-integration/README.md ("What's deliberately not
 *     implemented"):
 *     "Indirect / M:N relations through join tables."
 *
 *   - packages/3-extensions/sql-orm-client/src/collection-contract.ts
 *     parseRelationCardinality (line ~284): accepts '1:1' / 'N:1' /
 *     '1:N' / 'M:N'. Returns undefined for 'N:M', which is what the
 *     authoring DSL emits (lowering at contract-ts/contract-lowering.ts
 *     line 428).
 *
 *   - packages/3-extensions/sql-orm-client/src/types.ts (IncludeExpr,
 *     line 55): carries single-column localColumn/targetColumn. No
 *     `through` field. The data structure physically can't hold a
 *     junction join.
 *
 *   - packages/3-extensions/sql-orm-client/src/mutation-executor.ts
 *     line 343: `if (cardinality === 'M:N') throw new Error('M:N
 *     nested mutations are not supported yet');`
 */
import { Collection } from '@prisma-next/sql-orm-client';
import { describe, expect, it } from 'vitest';

describe('prisma-next orm-client M:N (upstream canary)', () => {
  it('Collection.include() on an N:M relation drops the cardinality and discards `through` metadata', () => {
    // Hand-crafted contract shaped like what `rel.manyToMany` lowers to.
    const contract = {
      target: 'sqlite' as const,
      targetFamily: 'sql' as const,
      capabilities: { sql: {}, sqlite: {} },
      models: {
        User: {
          fields: {
            id: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/integer@1' } },
          },
          relations: {
            tags: {
              to: 'Tag',
              cardinality: 'N:M', // what the DSL emits
              on: {
                localFields: ['id'],
                targetFields: ['userId'], // junction's parent-side FK column
              },
              through: {
                table: 'user_tag',
                parentCols: ['userId'],
                childCols: ['tagId'],
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
          storage: { table: 'tag', fields: { id: { column: 'id' }, name: { column: 'name' } } },
        },
      },
      storage: { storageHash: 'sha256:test', tables: {}, types: {} },
    } as never;

    const fakeRuntime = {} as never;
    const ctx = { contract, runtime: fakeRuntime, scope: {} } as never;

    const users = new Collection({ runtime: fakeRuntime, context: ctx }, 'User' as never);
    const withTags = users.include('tags' as never) as unknown as {
      state: { includes: unknown[] };
    };
    const inc = withTags.state.includes[0] as Record<string, unknown>;

    // The pin: the IncludeExpr looks like a regular single-column FK
    // join, with `targetColumn` pointing at a column that doesn't
    // exist on the Tag table. There's no `through` metadata, no
    // cardinality (parseRelationCardinality dropped 'N:M').
    expect(inc.relatedTableName).toBe('tag');
    expect(inc.localColumn).toBe('id');
    expect(inc.targetColumn).toBe('userId');
    // If either of these flips, prisma-next has added junction support
    // and we can drop the plugin's M:N rejection.
    expect(inc.cardinality).toBeUndefined();
    expect((inc as { through?: unknown }).through).toBeUndefined();
  });
});
