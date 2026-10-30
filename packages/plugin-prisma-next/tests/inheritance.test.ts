import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import { graphql } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './inheritance/contract';

const contract = contractFromJson<Contract>(
  JSON.parse(readFileSync(new URL('./inheritance/contract.json', import.meta.url), 'utf8')),
);
const statements: string[] = [];
const client = sqlite({
  contract,
  middleware: [
    {
      name: 'capture',
      familyId: 'sql',
      beforeEncode(plan) {
        statements.push(plan.sql);
        return Promise.resolve();
      },
    },
  ],
});
const { orm } = client;
const dir = mkdtempSync(join(tmpdir(), 'pothos-prisma-next-inheritance-'));

function createSchema(collections = false) {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract, ...(collections ? { collections: orm } : {}) },
  });
  const task = builder.prismaInterface('Task', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      owner: t.relation('owner'),
    }),
  });
  builder.prismaObject('Bug', {
    interfaces: [task],
    fields: (t) => ({ severity: t.exposeString('severity') }),
  });
  builder.prismaObject('Feature', {
    interfaces: [task],
    fields: (t) => ({ priority: t.exposeInt('priority') }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      email: t.exposeString('email'),
      tasks: t.relation('tasks', { query: { orderBy: (row) => row.id.asc() } }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      tasks: t.prismaField({
        type: ['Task'],
        resolve: () => orm.Task.orderBy((row) => row.id.asc()),
      }),
      bugs: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('bug') }),
      unfilteredBugs: t.prismaField({ type: ['Bug'], resolve: () => orm.Bug as never }),
      baseAsBugs: t.prismaField({ type: ['Bug'], resolve: () => orm.Task as never }),
      featurePage: t.prismaConnection({
        type: 'Feature',
        cursor: 'id',
        resolve: () => orm.Task.variant('feature'),
      }),
      users: t.prismaField({ type: ['User'], resolve: () => orm.User }),
    }),
  });
  return builder.toSchema();
}

describe('native model inheritance', () => {
  beforeAll(async () => {
    const path = join(dir, 'test.db');
    const db = new DatabaseSync(path);
    db.exec(`
      CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
      CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT);
      CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL);
      INSERT INTO user VALUES ('u1', 'a@example.com');
      INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high'), ('t2', 'feat1', 'feature', 'u1', NULL);
      INSERT INTO feature VALUES ('t2', 5);
    `);
    db.close();
    await client.connect({ path });
  });

  afterAll(async () => {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('routes interface rows by discriminator and plans variant fragments into one query', async () => {
    statements.length = 0;
    const result = await graphql({
      schema: createSchema(),
      source: `{
        tasks {
          __typename id owner { email }
          ... on Bug { severity }
          ... on Feature { priority }
        }
      }`,
      contextValue: {},
    });
    expect(result).toEqual({
      data: {
        tasks: [
          { __typename: 'Bug', id: 't1', owner: { email: 'a@example.com' }, severity: 'high' },
          { __typename: 'Feature', id: 't2', owner: { email: 'a@example.com' }, priority: 5 },
        ],
      },
    });
    expect(statements).toHaveLength(1);
  });

  it('routes rows that select no discriminator-bearing field', async () => {
    const result = await graphql({
      schema: createSchema(),
      source: '{ tasks { __typename } users { tasks { __typename title } } }',
      contextValue: {},
    });
    expect(result).toEqual({
      data: {
        tasks: [{ __typename: 'Bug' }, { __typename: 'Feature' }],
        users: [
          {
            tasks: [
              { __typename: 'Bug', title: 'bug1' },
              { __typename: 'Feature', title: 'feat1' },
            ],
          },
        ],
      },
    });
  });

  it('loads a variant with its inherited fields and relations', async () => {
    const result = await graphql({
      schema: createSchema(),
      source: `{
        bugs { id title severity owner { email } }
        featurePage(first: 1) { edges { node { title priority } } }
      }`,
      contextValue: {},
    });
    expect(result).toEqual({
      data: {
        bugs: [{ id: 't1', title: 'bug1', severity: 'high', owner: { email: 'a@example.com' } }],
        featurePage: { edges: [{ node: { title: 'feat1', priority: 5 } }] },
      },
    });
  });

  it.each([
    'unfilteredBugs',
    'baseAsBugs',
  ])('rejects %s, which would load other variants', async (field) => {
    const result = await graphql({
      schema: createSchema(),
      source: `{ ${field} { id } }`,
      contextValue: {},
    });
    expect(result.errors?.[0]?.message).toMatch(/orm\.Task\.variant\('bug'\)/);
  });

  it('fills variant fallbacks through the base collection', async () => {
    const result = await graphql({
      schema: createSchema(true),
      source: '{ tasks { id ... on Bug { owner { email } severity } } }',
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data?.tasks).toEqual([
      { id: 't1', owner: { email: 'a@example.com' }, severity: 'high' },
      { id: 't2' },
    ]);
  });
});
