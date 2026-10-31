/**
 * N:M relations only exist in TS-authored contracts (PSL decomposes explicit joins into plain 1:N
 * hops), so this hand-authors the shape `rel.manyToMany(...)` lowers to.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import SchemaBuilder from '@pothos/core';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin, { type AnyContract } from '../src';
import { buildRelationMeta } from '../src/utils/model';

const NS = '__unbound__';

// Post ⇄ Tag through `post_tag`. The junction table must be registered under storage so
// prisma-next can resolve the join.
const junctionContract = {
  schemaVersion: 1,
  targetFamily: 'sql',
  target: 'sqlite',
  profileHash: '1111111111111111111111111111111111111111111111111111111111111111',
  roots: {
    post: { model: 'Post', namespace: NS },
    tag: { model: 'Tag', namespace: NS },
  },
  capabilities: {
    sql: { foreignKeys: true, jsonAgg: true, limit: true, orderBy: true, returning: true },
  },
  domain: {
    namespaces: {
      [NS]: {
        models: {
          Post: {
            fields: {
              id: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/text@1' } },
              title: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/text@1' } },
            },
            relations: {
              tags: {
                to: { namespace: NS, model: 'Tag' },
                cardinality: 'N:M',
                on: { localFields: ['id'], targetFields: ['postId'] },
                through: {
                  table: 'post_tag',
                  namespaceId: NS,
                  parentColumns: ['postId'],
                  childColumns: ['tagId'],
                  targetColumns: ['id'],
                },
              },
            },
            storage: {
              namespaceId: NS,
              table: 'post',
              fields: { id: { column: 'id' }, title: { column: 'title' } },
            },
          },
          Tag: {
            fields: {
              id: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/text@1' } },
              name: { nullable: false, type: { kind: 'scalar', codecId: 'sqlite/text@1' } },
            },
            relations: {},
            storage: {
              namespaceId: NS,
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
        id: NS,
        entries: {
          table: {
            post: {
              columns: {
                id: { codecId: 'sqlite/text@1', dataType: 'sqlite/text', nullable: false },
                title: { codecId: 'sqlite/text@1', dataType: 'sqlite/text', nullable: false },
              },
              foreignKeys: [],
              indexes: [],
              primaryKey: { columns: ['id'] },
              uniques: [],
            },
            tag: {
              columns: {
                id: { codecId: 'sqlite/text@1', dataType: 'sqlite/text', nullable: false },
                name: { codecId: 'sqlite/text@1', dataType: 'sqlite/text', nullable: false },
              },
              foreignKeys: [],
              indexes: [],
              primaryKey: { columns: ['id'] },
              uniques: [],
            },
            post_tag: {
              columns: {
                postId: { codecId: 'sqlite/text@1', dataType: 'sqlite/text', nullable: false },
                tagId: { codecId: 'sqlite/text@1', dataType: 'sqlite/text', nullable: false },
              },
              foreignKeys: [
                {
                  source: { columns: ['postId'], namespaceId: NS, tableName: 'post_tag' },
                  target: { columns: ['id'], namespaceId: NS, tableName: 'post' },
                },
                {
                  source: { columns: ['tagId'], namespaceId: NS, tableName: 'post_tag' },
                  target: { columns: ['id'], namespaceId: NS, tableName: 'tag' },
                },
              ],
              indexes: [],
              primaryKey: { columns: ['postId', 'tagId'] },
              uniques: [],
            },
          },
        },
      },
    },
    storageHash: '2222222222222222222222222222222222222222222222222222222222222222',
    types: {},
  },
  execution: {
    executionHash: '3333333333333333333333333333333333333333333333333333333333333333',
    mutations: { defaults: [] },
  },
  extensions: {},
  meta: {},
} as unknown as AnyContract;

interface JunctionRuntime {
  ormClient: { Post: unknown; Tag: unknown };
  contract: AnyContract;
  cleanup: () => Promise<void>;
}

async function createJunctionRuntime(): Promise<JunctionRuntime> {
  const testDir = mkdtempSync(join(tmpdir(), 'pothos-prisma-next-junction-'));
  const dbPath = join(testDir, 'test.db');

  const rawDb = new DatabaseSync(dbPath);
  rawDb.exec('PRAGMA foreign_keys = ON');
  // The marker table prisma-next's sqlite control adapter reads, under `space = 'app'`.
  rawDb.exec(`
    CREATE TABLE _prisma_marker (
      space TEXT PRIMARY KEY NOT NULL,
      core_hash TEXT NOT NULL,
      profile_hash TEXT NOT NULL,
      contract_json TEXT,
      canonical_version INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      app_tag TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      invariants TEXT NOT NULL DEFAULT '[]'
    )
  `);
  const APP_SPACE_ID = 'app';
  const storageHash = (junctionContract as { storage?: { storageHash?: string } }).storage
    ?.storageHash;
  const profileHash = (junctionContract as { profileHash?: string }).profileHash;
  rawDb
    .prepare('INSERT INTO _prisma_marker (space, core_hash, profile_hash) VALUES (?, ?, ?)')
    .run(APP_SPACE_ID, storageHash ?? '', profileHash ?? '');

  rawDb.exec('CREATE TABLE post (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL)');
  rawDb.exec('CREATE TABLE tag (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL)');
  rawDb.exec(`
    CREATE TABLE post_tag (
      postId TEXT NOT NULL,
      tagId TEXT NOT NULL,
      PRIMARY KEY (postId, tagId),
      FOREIGN KEY (postId) REFERENCES post(id),
      FOREIGN KEY (tagId) REFERENCES tag(id)
    )
  `);
  rawDb.exec(`
    INSERT INTO post (id, title) VALUES
      ('p-hello', 'Hello, Pothos'),
      ('p-orm', 'On ORMs')
  `);
  rawDb.exec(`
    INSERT INTO tag (id, name) VALUES
      ('t-intro', 'intro'),
      ('t-graphql', 'graphql'),
      ('t-db', 'database')
  `);
  // graphql is shared so the junction fans out both ways.
  rawDb.exec(`
    INSERT INTO post_tag (postId, tagId) VALUES
      ('p-hello', 't-intro'),
      ('p-hello', 't-graphql'),
      ('p-orm', 't-graphql'),
      ('p-orm', 't-db')
  `);
  rawDb.close();

  const client = sqlite({ contract: contractFromJson(junctionContract) as never });
  const runtime = await client.connect({ path: dbPath });

  return {
    ormClient: client.orm as unknown as { Post: unknown; Tag: unknown },
    contract: junctionContract,
    cleanup: async () => {
      await runtime.close();
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

describe('N:M (junction) — schema build', () => {
  it('an N:M relation exposed via t.relation builds without throwing', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: junctionContract },
    });
    builder.prismaObject(
      'Tag' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          name: (t as { exposeString: (n: string) => unknown }).exposeString('name'),
        }),
      } as never,
    );
    builder.prismaObject(
      'Post' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          tags: (t as { relation: (n: string) => unknown }).relation('tags'),
        }),
      } as never,
    );
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });

  it('the relation meta for an N:M relation is to-many and keys on the parent columns', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: junctionContract },
    });
    builder.prismaObject(
      'Tag' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
        }),
      } as never,
    );
    builder.prismaObject(
      'Post' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          tags: (t as { relation: (n: string) => unknown }).relation('tags'),
        }),
      } as never,
    );
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    builder.toSchema();
    const rels = buildRelationMeta('Post', junctionContract, 'Post')!;
    expect(rels.tags).toBeDefined();
    expect(rels.tags!.isToMany).toBe(true);
    expect(rels.tags!.localFields).toEqual(['id']);
    expect(rels.tags!.targetModel).toBe('Tag');
  });
});

describe('N:M (junction) — end-to-end against real sqlite', () => {
  let rt: JunctionRuntime;

  beforeAll(async () => {
    rt = await createJunctionRuntime();
  });

  afterAll(async () => {
    await rt?.cleanup();
  });

  function buildSchema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: rt.contract },
    });
    builder.prismaObject(
      'Tag' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          name: (t as { exposeString: (n: string) => unknown }).exposeString('name'),
        }),
      } as never,
    );
    builder.prismaObject(
      'Post' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          title: (t as { exposeString: (n: string) => unknown }).exposeString('title'),
          tags: (t as { relation: (n: string) => unknown }).relation('tags'),
        }),
      } as never,
    );
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: (() => rt.ormClient.Post) as never,
        } as never),
      }),
    });
    return builder.toSchema();
  }

  it('resolves a junction-joined N:M relation in a GraphQL query', async () => {
    const result = await Promise.resolve(
      execute({
        schema: buildSchema(),
        document: parse('{ posts { id title tags { id name } } }'),
        contextValue: {},
      }),
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      posts: Array<{ id: string; title: string; tags: Array<{ id: string; name: string }> }>;
    };
    const byId = Object.fromEntries(
      data.posts.map((p) => [p.id, p.tags.map((tag) => tag.name).sort()]),
    );
    expect(byId).toEqual({
      'p-hello': ['graphql', 'intro'],
      'p-orm': ['database', 'graphql'],
    });
  });

  it('honors a nested refine (where) on the junction relation', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: rt.contract },
    });
    builder.prismaObject(
      'Tag' as never,
      {
        fields: (t: never) => ({
          name: (t as { exposeString: (n: string) => unknown }).exposeString('name'),
        }),
      } as never,
    );
    builder.prismaObject(
      'Post' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          graphqlTags: (
            t as {
              relation: (n: string, opts: unknown) => unknown;
            }
          ).relation('tags', {
            query: {
              where: (tag: { name: { eq: (v: string) => unknown } }) => tag.name.eq('graphql'),
            },
          }),
        }),
      } as never,
    );
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: (() => rt.ormClient.Post) as never,
        } as never),
      }),
    });
    const result = await Promise.resolve(
      execute({
        schema: builder.toSchema(),
        document: parse('{ posts { id graphqlTags { name } } }'),
        contextValue: {},
      }),
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      posts: Array<{ id: string; graphqlTags: Array<{ name: string }> }>;
    };
    for (const post of data.posts) {
      expect(post.graphqlTags.map((tag) => tag.name)).toEqual(['graphql']);
    }
  });
});
