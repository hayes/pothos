import { readFileSync } from 'node:fs';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import { graphql } from 'graphql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './namespaces/contract';

const url =
  process.env.POTHOS_PRISMA_NEXT_DATABASE_URL ??
  'postgresql://prisma:prisma@localhost:5456/prisma_next';
const contract = contractFromJson<Contract>(
  JSON.parse(readFileSync(new URL('./namespaces/contract.json', import.meta.url), 'utf8')),
);
const client = postgres({ contract, url, verifyMarker: false });
const raw = new Client({ connectionString: url });
const { nsa, nsb } = client.orm;

function createBuilder(collections?: 'orm') {
  return new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: {
      contract,
      ...(collections ? { collections: client.orm } : {}),
    },
  });
}

function createSchema(collections?: 'orm') {
  const builder = createBuilder(collections);
  builder.prismaObject('nsa.User', {
    fields: (t) => ({
      id: t.exposeInt('id'),
      orgId: t.exposeInt('orgId'),
      posts: t.relation('posts', { query: { orderBy: (post) => post.id.asc() } }),
      postsPage: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
    }),
  });
  const post = builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeInt('id'),
      title: t.exposeString('title'),
      user: t.relation('user'),
    }),
  });
  builder.prismaObject('nsb.User', {
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      a: t.prismaField({ type: ['nsa.User'], resolve: () => nsa.User }),
      b: t.prismaField({ type: ['nsb.User'], resolve: () => nsb.User }),
      posts: t.prismaConnection({ type: 'Post', cursor: 'id', resolve: () => nsa.Post }),
      plain: t.field({
        type: post,
        resolve: () => ({ id: 1, title: 'first', userId: 1 }) as never,
      }),
    }),
  });
  return builder.toSchema();
}

describe('models sharing a name across namespaces', () => {
  beforeAll(async () => {
    await raw.connect();
    await raw.query(`
      DROP SCHEMA IF EXISTS nsa CASCADE;
      DROP SCHEMA IF EXISTS nsb CASCADE;
      CREATE SCHEMA nsa;
      CREATE SCHEMA nsb;
      CREATE TABLE nsa."user" (id integer PRIMARY KEY, "orgId" integer NOT NULL);
      CREATE TABLE nsa.post (id integer PRIMARY KEY, title text NOT NULL, "userId" integer NOT NULL);
      CREATE TABLE nsb."user" (id text PRIMARY KEY, name text NOT NULL);
      INSERT INTO nsa."user" VALUES (1, 10);
      INSERT INTO nsa.post VALUES (1, 'first', 1), (2, 'second', 1);
      INSERT INTO nsb."user" VALUES ('x', 'Xena');
    `);
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await raw.query('DROP SCHEMA IF EXISTS nsa CASCADE; DROP SCHEMA IF EXISTS nsb CASCADE');
    await raw.end();
  });

  it('rejects an ambiguous bare name, naming the qualified forms', () => {
    const builder = createBuilder();
    builder.prismaObject('User' as never, { fields: () => ({}) });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(
      /Model 'User' exists in namespaces 'nsa', 'nsb'.*'nsa\.User'.*'nsb\.User'/,
    );
  });

  it('rejects a qualified name for a model only one namespace has', () => {
    const builder = createBuilder();
    builder.prismaObject('nsa.Post' as never, { fields: () => ({}) });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(/Use the bare name 'Post'/);
  });

  it('gives qualified models distinct default GraphQL types', async () => {
    const schema = createSchema();
    expect(Object.keys(schema.getTypeMap())).toEqual(
      expect.arrayContaining(['nsa_User', 'nsb_User', 'Post']),
    );
    const result = await graphql({
      schema,
      source: '{ a { __typename id orgId } b { __typename id name } }',
      contextValue: {},
    });
    expect(result).toEqual({
      data: {
        a: [{ __typename: 'nsa_User', id: 1, orgId: 10 }],
        b: [{ __typename: 'nsb_User', id: 'x', name: 'Xena' }],
      },
    });
  });

  it('follows relations into the qualified model of the same namespace', async () => {
    const result = await graphql({
      schema: createSchema(),
      source: `{
        a { posts { title user { __typename orgId } } postsPage(first: 1) { totalCount edges { node { id } } } }
        posts(first: 1) { edges { node { user { orgId } } } }
      }`,
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      a: [
        {
          posts: [
            { title: 'first', user: { __typename: 'nsa_User', orgId: 10 } },
            { title: 'second', user: { __typename: 'nsa_User', orgId: 10 } },
          ],
          postsPage: { totalCount: 2, edges: [{ node: { id: 1 } }] },
        },
      ],
      posts: { edges: [{ node: { user: { orgId: 10 } } }] },
    });
  });

  it('finds fallback collections in a namespaced ORM client', async () => {
    const result = await graphql({
      schema: createSchema('orm'),
      source: '{ plain { user { orgId } } }',
      contextValue: {},
    });
    expect(result).toEqual({ data: { plain: { user: { orgId: 10 } } } });
  });
});
