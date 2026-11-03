// N:M relations only exist in TS-authored contracts (PSL decomposes explicit joins into plain 1:N
// hops), so this hand-authors the shape `rel.manyToMany(...)` lowers to.
import type postgres from '@prisma/orm-postgres/runtime';
import type sqlite from '@prisma/orm-sqlite/runtime';
import type { AnyContract } from '../../src';

type SqliteContract = Parameters<typeof sqlite>[0]['contract'];
type PostgresContract = Parameters<typeof postgres>[0]['contract'];

interface JunctionTarget {
  target: string;
  ns: string;
  text: { codecId: string; dataType: string };
  tables: { post: string; tag: string; postTag: string };
  capabilities: object;
  storageNamespace: object;
}

function junction({ target, ns, text, tables, capabilities, storageNamespace }: JunctionTarget) {
  return {
    schemaVersion: 1,
    targetFamily: 'sql',
    target,
    profileHash: '1111111111111111111111111111111111111111111111111111111111111111',
    roots: {
      [tables.post]: { model: 'Post', namespace: ns },
      [tables.tag]: { model: 'Tag', namespace: ns },
    },
    capabilities,
    domain: {
      namespaces: {
        [ns]: {
          models: {
            Post: {
              fields: {
                id: { nullable: false, type: { kind: 'scalar', codecId: text.codecId } },
                title: { nullable: false, type: { kind: 'scalar', codecId: text.codecId } },
              },
              relations: {
                tags: {
                  to: { namespace: ns, model: 'Tag' },
                  cardinality: 'N:M',
                  on: { localFields: ['id'], targetFields: ['postId'] },
                  through: {
                    table: tables.postTag,
                    namespaceId: ns,
                    parentColumns: ['postId'],
                    childColumns: ['tagId'],
                    targetColumns: ['id'],
                  },
                },
              },
              storage: {
                namespaceId: ns,
                table: tables.post,
                fields: { id: { column: 'id' }, title: { column: 'title' } },
              },
            },
            Tag: {
              fields: {
                id: { nullable: false, type: { kind: 'scalar', codecId: text.codecId } },
                name: { nullable: false, type: { kind: 'scalar', codecId: text.codecId } },
              },
              relations: {},
              storage: {
                namespaceId: ns,
                table: tables.tag,
                fields: { id: { column: 'id' }, name: { column: 'name' } },
              },
            },
          },
        },
      },
    },
    storage: {
      namespaces: {
        [ns]: {
          id: ns,
          ...storageNamespace,
          entries: {
            table: {
              [tables.post]: {
                columns: {
                  id: { codecId: text.codecId, dataType: text.dataType, nullable: false },
                  title: { codecId: text.codecId, dataType: text.dataType, nullable: false },
                },
                foreignKeys: [],
                indexes: [],
                primaryKey: { columns: ['id'] },
                uniques: [],
              },
              [tables.tag]: {
                columns: {
                  id: { codecId: text.codecId, dataType: text.dataType, nullable: false },
                  name: { codecId: text.codecId, dataType: text.dataType, nullable: false },
                },
                foreignKeys: [],
                indexes: [],
                primaryKey: { columns: ['id'] },
                uniques: [],
              },
              [tables.postTag]: {
                columns: {
                  postId: { codecId: text.codecId, dataType: text.dataType, nullable: false },
                  tagId: { codecId: text.codecId, dataType: text.dataType, nullable: false },
                },
                foreignKeys: [
                  {
                    source: { columns: ['postId'], namespaceId: ns, tableName: tables.postTag },
                    target: { columns: ['id'], namespaceId: ns, tableName: tables.post },
                  },
                  {
                    source: { columns: ['tagId'], namespaceId: ns, tableName: tables.postTag },
                    target: { columns: ['id'], namespaceId: ns, tableName: tables.tag },
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
  };
}

export const junctionContract = junction({
  target: 'sqlite',
  ns: '__unbound__',
  text: { codecId: 'sqlite/text@1', dataType: 'sqlite/text' },
  tables: { post: 'post', tag: 'tag', postTag: 'post_tag' },
  capabilities: {
    sql: { foreignKeys: true, jsonAgg: true, limit: true, orderBy: true, returning: true },
  },
  storageNamespace: {},
}) as unknown as AnyContract & SqliteContract;

/** The same relation on Postgres, in tables of its own so it can share a database. */
export const postgresJunctionTables = {
  post: 'pothos_next_junction_post',
  tag: 'pothos_next_junction_tag',
  postTag: 'pothos_next_junction_post_tag',
};

export const postgresJunctionContract = junction({
  target: 'postgres',
  ns: 'public',
  text: { codecId: 'pg/text@1', dataType: 'pg/text' },
  tables: postgresJunctionTables,
  capabilities: {
    postgres: { jsonAgg: true, lateral: true, limit: true, orderBy: true, returning: true },
    sql: { lateral: true, returning: true },
  },
  storageNamespace: { kind: 'postgres-schema' },
}) as unknown as AnyContract & PostgresContract;

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
