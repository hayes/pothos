import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import postgres from '@prisma/orm-postgres/runtime';
import { graphql } from 'graphql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { loadPostgresContract, postgresUrl as url } from './fixtures/helpers';
import type { Contract as InheritanceContract } from './inheritance-namespaces/contract';
import type { Contract } from './namespaces/contract';

const contract = loadPostgresContract<Contract>(
  new URL('./namespaces/contract.json', import.meta.url),
);
const client = postgres({ contract, url, verifyMarker: false });
const raw = new Client({ connectionString: url });
const rawInheritance = new Client({ connectionString: url });
const { nsa, nsb } = client.orm;

function createBuilder() {
  return new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client },
  });
}

function createSchema() {
  const builder = createBuilder();
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
  const nsbUser = builder.prismaObject('nsb.User', {
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
        resolve: () => ({ id: 1, title: 'first', userId: 1 }),
      }),
      plainB: t.field({ type: nsbUser, resolve: () => ({ id: 'x' }) }),
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

  it('rejects a qualified name in a namespace without that model', () => {
    const builder = createBuilder();
    builder.prismaObject('nsc.User' as never, { fields: () => ({}) });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(
      "Model 'nsc.User' not found in the prismaNext contract.",
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
      schema: createSchema(),
      source: '{ plain { user { orgId } } plainB { name } }',
      contextValue: {},
    });
    expect(result).toEqual({ data: { plain: { user: { orgId: 10 } }, plainB: { name: 'Xena' } } });
  });
});

const inheritanceContract = loadPostgresContract<InheritanceContract>(
  new URL('./inheritance-namespaces/contract.json', import.meta.url),
);
const inheritanceClient = postgres({ contract: inheritanceContract, url, verifyMarker: false });
const { inha, inhb } = inheritanceClient.orm;

function createInheritanceSchema(bugName?: string) {
  const builder = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client: inheritanceClient },
  });
  const aTask = builder.prismaInterface('inha.Task', {
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.prismaObject('inha.Bug', {
    ...(bugName ? { variant: bugName } : {}),
    interfaces: [aTask],
    fields: (t) => ({ severity: t.exposeString('severity') }),
  });
  builder.prismaObject('Feature', {
    interfaces: [aTask],
    fields: (t) => ({ priority: t.exposeInt('priority') }),
  });
  // A variant in another namespace than its base.
  builder.prismaObject('Chore', {
    interfaces: [aTask],
    fields: (t) => ({ note: t.exposeString('note') }),
  });
  const bTask = builder.prismaInterface('inhb.Task', {
    fields: (t) => ({ label: t.exposeString('label') }),
  });
  builder.prismaNode('inhb.Bug', {
    interfaces: [bTask],
    id: { field: 'id' },
    collection: () => inhb.Task.variant('b'),
    fields: (t) => ({ level: t.exposeInt('level') }),
  });
  builder.queryType({
    fields: (t) => ({
      aTasks: t.prismaField({
        type: [aTask],
        resolve: () => inha.Task.orderBy((row) => row.id.asc()),
      }),
      bTasks: t.prismaField({ type: [bTask], resolve: () => inhb.Task }),
    }),
  });
  return builder.toSchema();
}

describe('native inheritance across namespaces', () => {
  beforeAll(async () => {
    await rawInheritance.connect();
    await rawInheritance.query(`
      DROP SCHEMA IF EXISTS inha CASCADE;
      DROP SCHEMA IF EXISTS inhb CASCADE;
      CREATE SCHEMA inha;
      CREATE SCHEMA inhb;
      CREATE TABLE inha.task (id text PRIMARY KEY, title text NOT NULL, type text NOT NULL, severity text);
      CREATE TABLE inha.feature (id text PRIMARY KEY, priority integer NOT NULL);
      CREATE TABLE inhb.task (id integer PRIMARY KEY, label text NOT NULL, kind text NOT NULL, level integer);
      CREATE TABLE inhb.chore (id text PRIMARY KEY, note text NOT NULL);
      INSERT INTO inha.task VALUES ('t1', 'bug1', 'bug', 'high'), ('t2', 'feat1', 'feature', NULL), ('t3', 'chore1', 'chore', NULL);
      INSERT INTO inha.feature VALUES ('t2', 5);
      INSERT INTO inhb.chore VALUES ('t3', 'sweep');
      INSERT INTO inhb.task VALUES (1, 'b1', 'b', 7);
    `);
    await inheritanceClient.connect();
  });

  afterAll(async () => {
    await inheritanceClient.close();
    await rawInheritance.query(
      'DROP SCHEMA IF EXISTS inha CASCADE; DROP SCHEMA IF EXISTS inhb CASCADE;',
    );
    await rawInheritance.end();
  });

  it('routes rows to variants of same-named hierarchies, including a variant in another namespace', async () => {
    const result = await graphql({
      schema: createInheritanceSchema(),
      source: `{
        aTasks {
          __typename title
          ... on inha_Bug { severity }
          ... on Feature { priority }
          ... on Chore { note }
        }
        bTasks { __typename label ... on inhb_Bug { level } }
      }`,
      contextValue: {},
    });
    expect(result).toEqual({
      data: {
        aTasks: [
          { __typename: 'inha_Bug', title: 'bug1', severity: 'high' },
          { __typename: 'Feature', title: 'feat1', priority: 5 },
          { __typename: 'Chore', title: 'chore1', note: 'sweep' },
        ],
        bTasks: [{ __typename: 'inhb_Bug', label: 'b1', level: 7 }],
      },
    });
  });

  it('loads a qualified prismaNode through node(id:)', async () => {
    const schema = createInheritanceSchema();
    const list = await graphql({
      schema,
      source: '{ bTasks { ... on inhb_Bug { id } } }',
      contextValue: {},
    });
    const id = (list.data as { bTasks: { id: string }[] }).bTasks[0].id;
    const result = await graphql({
      schema,
      source: `{ node(id: "${id}") { __typename ... on inhb_Bug { label level } } }`,
      contextValue: {},
    });
    expect(result).toEqual({ data: { node: { __typename: 'inhb_Bug', label: 'b1', level: 7 } } });
  });

  it('routes rows to a qualified variant registered under a custom name', async () => {
    const result = await graphql({
      schema: createInheritanceSchema('BugReport'),
      source: '{ aTasks { __typename } }',
      contextValue: {},
    });
    expect(result).toEqual({
      data: {
        aTasks: [{ __typename: 'BugReport' }, { __typename: 'Feature' }, { __typename: 'Chore' }],
      },
    });
  });
});
