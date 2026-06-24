/**
 * Upstream canary: pins prisma-next's CURRENT M:N support state so a
 * future change to it fails loudly and tells us when to revisit the
 * plugin's M:N rejection in `buildRelationMeta`.
 *
 * As of prisma-next 0.14.0 (ADR-221 contract restructure) junction-table
 * support has LANDED upstream in `@prisma-next/sql-orm-client`:
 *
 *   - `parseRelationCardinality` now accepts `'N:M'` (dist/index.mjs
 *     ~line 267) — it is no longer dropped.
 *
 *   - `IncludeExpr` now carries an optional `through?: IncludeThroughDescriptor`
 *     (dist/index.d.mts ~line 52). The descriptor holds the junction
 *     table, its parent/child/target FK columns, and the resolved
 *     parentLocalColumns.
 *
 *   - `Collection.include()` → `resolveIncludeRelation` (dist/index.mjs
 *     ~line 182) reads `relation.through` and emits a populated
 *     `through` on the IncludeExpr; `buildIncludeChildRowsSelect`
 *     (~line 1101) actually builds the junction join via
 *     `buildManyToManyJunctionArtifacts`.
 *
 * So at the orm-client level, N:M is now a real, joinable relation when
 * the contract is TS-authored and declares a `through` block (i.e.
 * `rel.manyToMany`). This canary pins THAT behavior: `.include()` on an
 * N:M relation now keeps `cardinality: 'N:M'` and carries the full
 * `through` descriptor.
 *
 * What this means for the plugin: the plugin now SUPPORTS N:M relations
 * (`buildRelationMeta` in src/index.ts treats N:M as a to-many relation
 * and carries the `through` descriptor on the relation meta; the walker
 * emits `.include(rel)` and prisma-next resolves the junction join from
 * the contract's `through`). End-to-end junction support is exercised in
 * tests/junction-runtime.test.ts. This canary stays to pin the UPSTREAM
 * behavior the plugin relies on — if either the preserved cardinality or
 * the resolved `through` descriptor flips back, prisma-next has regressed
 * N:M support and the plugin's assumptions break.
 */
import { Collection } from '@prisma-next/sql-orm-client';
import { describe, expect, it } from 'vitest';

describe('prisma-next orm-client M:N (upstream canary)', () => {
  it('Collection.include() on an N:M relation keeps the cardinality and carries the `through` junction descriptor', () => {
    const NS = '__unbound__';
    // Hand-crafted contract shaped like what `rel.manyToMany` lowers to
    // under the 0.14.0 ADR-221 structure: models live under
    // `domain.namespaces.<ns>.models`, relations use a `to: { namespace,
    // model }` CrossReference, and N:M relations declare a `through`
    // block. The junction table must also exist under
    // `storage.namespaces.<ns>.entries.table` for `resolveThrough` to
    // resolve it (otherwise the `through` descriptor is silently dropped).
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
    // 0.14.0's Collection ctx wraps everything under `context`, and the
    // contract is read off `ctx.context.contract`.
    const ctx = { context: { contract, runtime: fakeRuntime, scope: {} } } as never;

    // 0.14.0's Collection constructor is `(ctx, modelName, options)`; the
    // options object now requires `namespaceId`.
    const users = new Collection(ctx, 'User' as never, { namespaceId: NS } as never);
    const withTags = users.include('tags' as never) as unknown as {
      state: { includes: unknown[] };
    };
    const inc = withTags.state.includes[0] as Record<string, unknown>;

    // The pin, observed against orm-client 0.14.0:
    expect(inc.relatedModelName).toBe('Tag');
    expect(inc.relatedTableName).toBe('tag');
    expect(inc.localColumn).toBe('id');
    expect(inc.targetColumn).toBe('id');

    // Junction support has landed upstream: the cardinality is preserved
    // (no longer dropped to undefined) and a fully-resolved `through`
    // descriptor rides along. If either of these flips back, prisma-next
    // has REGRESSED N:M support and the plugin's assumptions break.
    expect(inc.cardinality).toBe('N:M');
    const through = inc.through as Record<string, unknown> | undefined;
    expect(through).toBeDefined();
    expect(through).toMatchObject({
      table: 'user_tag',
      namespaceId: NS,
      parentColumns: ['userId'],
      childColumns: ['tagId'],
      targetColumns: ['id'],
      // resolveIncludeRelation resolves the parent-side local columns from
      // the relation's `on.localFields` (id → id here).
      parentLocalColumns: ['id'],
    });
  });
});
