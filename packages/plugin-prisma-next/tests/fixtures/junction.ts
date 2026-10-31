// N:M relations only exist in TS-authored contracts (PSL decomposes explicit joins into plain 1:N
// hops), so this hand-authors the shape `rel.manyToMany(...)` lowers to.
import type sqlite from '@prisma/orm-sqlite/runtime';
import type { AnyContract } from '../../src';

type SqliteContract = Parameters<typeof sqlite>[0]['contract'];
const NS = '__unbound__';

export const junctionContract = {
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
} as unknown as AnyContract & SqliteContract;

export const junctionDdl = `
  CREATE TABLE post (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL);
  CREATE TABLE tag (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
  CREATE TABLE post_tag (
    postId TEXT NOT NULL REFERENCES post(id), tagId TEXT NOT NULL REFERENCES tag(id),
    PRIMARY KEY (postId, tagId)
  );
  INSERT INTO post VALUES ('p-hello', 'Hello, Pothos'), ('p-orm', 'On ORMs');
  INSERT INTO tag VALUES ('t-intro', 'intro'), ('t-graphql', 'graphql'), ('t-db', 'database');
  INSERT INTO post_tag VALUES
    ('p-hello', 't-intro'), ('p-hello', 't-graphql'), ('p-orm', 't-graphql'), ('p-orm', 't-db');
`;
