import SchemaBuilder from '@pothos/core';
import postgres from '@prisma/orm-postgres/runtime';
import { graphql } from 'graphql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import PrismaNextPlugin from '../src';
import { postgresUrl as url } from './fixtures/helpers';
import { postgresJunctionContract, postgresJunctionTables } from './fixtures/junction';

const { post, tag, postTag } = postgresJunctionTables;
let statements = 0;
const client = postgres({
  contract: postgresJunctionContract,
  url,
  verifyMarker: false,
  middleware: [
    {
      name: 'pothos-test-statement-count',
      familyId: 'sql',
      beforeEncode() {
        statements += 1;
        return Promise.resolve();
      },
    },
  ],
});
const raw = new Client({ connectionString: url });

// The contract is hand-authored, so its models are untyped and the builder is reached through
// a loose view of it, as in the SQLite N:M test.
function schema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: typeof postgresJunctionContract }>({
    plugins: [PrismaNextPlugin],
    prismaNext: { client },
  });
  const b = builder as unknown as {
    prismaObject(name: string, options: { fields: (t: never) => object }): unknown;
  };
  type T = {
    exposeString(name: string): unknown;
    relation(name: string, options?: object): unknown;
  };
  b.prismaObject('Tag', { fields: (t: T) => ({ name: t.exposeString('name') }) });
  b.prismaObject('Post', {
    fields: (t: T) => ({
      title: t.exposeString('title'),
      tags: t.relation('tags', {
        query: { orderBy: { name: 'asc' } },
      }),
      graphqlTags: t.relation('tags', {
        query: { where: (row: { name: { eq(v: string): unknown } }) => row.name.eq('graphql') },
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({
        type: ['Post'] as never,
        query: () =>
          (
            client.orm as unknown as { public: { Post: { orderBy(f: unknown): never } } }
          ).public.Post.orderBy((row: { id: { asc(): unknown } }) => row.id.asc()),
      }),
    }),
  });
  return builder.toSchema();
}

describe('many-to-many relations on Postgres', () => {
  beforeAll(async () => {
    await raw.connect();
    await raw.query(`
      DROP TABLE IF EXISTS ${postTag}, ${post}, ${tag};
      CREATE TABLE ${post} (id text PRIMARY KEY, title text NOT NULL);
      CREATE TABLE ${tag} (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE ${postTag} (
        "postId" text NOT NULL REFERENCES ${post}(id),
        "tagId" text NOT NULL REFERENCES ${tag}(id),
        PRIMARY KEY ("postId", "tagId")
      );
      INSERT INTO ${post} VALUES ('p-hello', 'Hello, Pothos'), ('p-orm', 'On ORMs');
      INSERT INTO ${tag} VALUES ('t-intro', 'intro'), ('t-graphql', 'graphql'), ('t-db', 'database');
      INSERT INTO ${postTag} VALUES
        ('p-hello', 't-intro'), ('p-hello', 't-graphql'), ('p-orm', 't-graphql'), ('p-orm', 't-db');
    `);
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await raw.query(`DROP TABLE IF EXISTS ${postTag}, ${post}, ${tag}`);
    await raw.end();
  });

  it('loads an N:M relation and a refined alias of it in one statement', async () => {
    statements = 0;
    const result = await graphql({
      schema: schema(),
      source: '{ posts { title tags { name } graphqlTags { name } } }',
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      posts: [
        {
          title: 'Hello, Pothos',
          tags: [{ name: 'graphql' }, { name: 'intro' }],
          graphqlTags: [{ name: 'graphql' }],
        },
        {
          title: 'On ORMs',
          tags: [{ name: 'database' }, { name: 'graphql' }],
          graphqlTags: [{ name: 'graphql' }],
        },
      ],
    });
    expect(statements).toBe(1);
  });
});
