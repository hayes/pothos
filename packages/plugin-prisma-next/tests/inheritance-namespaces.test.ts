import { readFileSync } from 'node:fs';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import { graphql } from 'graphql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './inheritance-namespaces/contract';

const url =
  process.env.POTHOS_PRISMA_NEXT_DATABASE_URL ??
  'postgresql://prisma:prisma@localhost:5456/prisma_next';
const contract = contractFromJson<Contract>(
  JSON.parse(
    readFileSync(new URL('./inheritance-namespaces/contract.json', import.meta.url), 'utf8'),
  ),
);
const client = postgres({ contract, url, verifyMarker: false });
const raw = new Client({ connectionString: url });
const { inha, inhb } = client.orm;

function createSchema(bugName?: string) {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract },
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
    await raw.connect();
    await raw.query(`
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
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await raw.query('DROP SCHEMA IF EXISTS inha CASCADE; DROP SCHEMA IF EXISTS inhb CASCADE;');
    await raw.end();
  });

  it('routes rows to variants of same-named hierarchies, including a variant in another namespace', async () => {
    const result = await graphql({
      schema: createSchema(),
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
    const schema = createSchema();
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
      schema: createSchema('BugReport'),
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
