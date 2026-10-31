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

/** Variant-declared relations, relations typed as or targeting a variant, and a variant node. */
function createVariantSchema(collections = false) {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract, ...(collections ? { collections: orm } : {}) },
  });
  const task = builder.prismaInterface('Task', {
    fields: (t) => ({
      title: t.exposeString('title'),
      owner: t.relation('owner'),
    }),
  });
  const bug = builder.prismaObject('Bug', {
    interfaces: [task],
    fields: (t) => ({
      severity: t.exposeString('severity'),
      reviewer: t.relation('reviewer', { nullable: true }),
    }),
  });
  const feature = builder.prismaNode('Feature', {
    interfaces: [task],
    id: { field: 'id' },
    collection: () => orm.Task.variant('feature'),
    fields: (t) => ({ priority: t.exposeInt('priority') }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      email: t.exposeString('email'),
      tasks: t.relation('tasks', { query: { orderBy: (row) => row.id.asc() } }),
      // The option's type accepts refs of the relation's own model only; a variant ref needs a cast.
      bugs: t.relation('tasks', { type: bug }),
      bugPage: t.relatedConnection('tasks', {
        type: bug,
        cursor: 'id',
        totalCount: true,
      }),
      reviews: t.relation('reviews'),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      tasks: t.prismaField({
        type: ['Task'],
        resolve: () => orm.Task.orderBy((row) => row.id.asc()),
      }),
      bugs: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('bug') }),
      users: t.prismaField({ type: ['User'], resolve: () => orm.User }),
      orphanFeature: t.field({
        type: feature,
        resolve: () => ({ title: 'orphan', priority: 1 }) as never,
      }),
    }),
  });
  return builder.toSchema();
}

function builderTask(
  builder: PothosSchemaTypes.SchemaBuilder<
    PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>
  >,
  resolveType?: () => string,
) {
  return builder.prismaInterface('Task', {
    ...(resolveType ? { resolveType } : {}),
    fields: (t) => ({ title: t.exposeString('title') }),
  });
}

function run(schema: ReturnType<typeof createVariantSchema>, source: string) {
  statements.length = 0;
  return graphql({ schema, source, contextValue: {} });
}

describe('native model inheritance', () => {
  beforeAll(async () => {
    const path = join(dir, 'test.db');
    const db = new DatabaseSync(path);
    db.exec(`
      CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
      CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
      CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL);
      INSERT INTO user VALUES ('u1', 'a@example.com');
      -- The feature row carries a reviewerId only Bug maps, so a relation to Bug must filter it out.
      INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'), ('t2', 'feat1', 'feature', 'u1', NULL, 'u1');
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

  it('loads a relation a variant declares through orm.Task.variant()', async () => {
    for (const collections of [false, true]) {
      const result = await run(
        createVariantSchema(collections),
        '{ bugs { title reviewer { email } } }',
      );
      expect(result).toEqual({
        data: { bugs: [{ title: 'bug1', reviewer: { email: 'a@example.com' } }] },
      });
      expect(statements).toHaveLength(1);
    }
  });

  it('loads a variant-declared relation beneath the base interface through the loader', async () => {
    const source = '{ tasks { title ... on Bug { reviewer { email } } } }';
    const result = await run(createVariantSchema(true), source);
    expect(result).toEqual({
      data: {
        tasks: [{ title: 'bug1', reviewer: { email: 'a@example.com' } }, { title: 'feat1' }],
      },
    });
    expect(statements).toHaveLength(2);

    // Without a provider the unnarrowed base collection can't include it: a clear error, no SQL.
    const unnarrowed = await run(createVariantSchema(), source);
    expect(unnarrowed.errors?.[0]?.message).toMatch(
      /Relation "reviewer" is declared on variant 'bug'.*orm\.Task\.variant\('bug'\)/,
    );
    expect(statements).toHaveLength(0);
  });

  it('narrows a relation and connection typed as a variant to that variant', async () => {
    const result = await run(
      createVariantSchema(),
      `{ users {
        bugs { __typename title reviewer { email } }
        bugPage(first: 5) { totalCount edges { node { title } } }
      } }`,
    );
    expect(result).toEqual({
      data: {
        users: [
          {
            bugs: [{ __typename: 'Bug', title: 'bug1', reviewer: { email: 'a@example.com' } }],
            bugPage: { totalCount: 1, edges: [{ node: { title: 'bug1' } }] },
          },
        ],
      },
    });
    expect(statements).toHaveLength(1);
  });

  it('filters a relation targeting a single-table variant by discriminator', async () => {
    const result = await run(createVariantSchema(), '{ users { reviews { title severity } } }');
    expect(result).toEqual({
      data: { users: [{ reviews: [{ title: 'bug1', severity: 'high' }] }] },
    });
  });

  it('loads relations a variant target inherits through the loader', async () => {
    const source = '{ users { reviews { title owner { email } reviewer { email } } } }';
    const result = await run(createVariantSchema(true), source);
    expect(result).toEqual({
      data: {
        users: [
          {
            reviews: [
              {
                title: 'bug1',
                owner: { email: 'a@example.com' },
                reviewer: { email: 'a@example.com' },
              },
            ],
          },
        ],
      },
    });

    const withoutProvider = await run(createVariantSchema(), source);
    expect(withoutProvider.errors?.[0]?.message).toMatch(
      /Relation "owner" is inherited from model Task.*variant model 'Bug'/,
    );
  });

  it('plans fragments on Node beneath the interface for the implementations that are nodes', async () => {
    const result = await run(createVariantSchema(), '{ tasks { __typename ... on Node { id } } }');
    expect(result.errors).toBeUndefined();
    const [bug, feature] = (result.data as { tasks: { __typename: string; id?: string }[] }).tasks;
    expect(bug).toEqual({ __typename: 'Bug' });
    expect(Buffer.from(feature.id!, 'base64').toString()).toBe('Feature:t2');
    expect(statements).toHaveLength(1);
  });

  it('refuses to encode a node ID for a row without its id field', async () => {
    const result = await run(createVariantSchema(), '{ orphanFeature { id } }');
    expect(result.errors?.[0]?.message).toMatch(/row is missing id field 'id'/);
  });

  it('does not reload inherited fields the interface query already loaded', async () => {
    for (const collections of [false, true]) {
      const result = await run(
        createVariantSchema(collections),
        '{ users { tasks { owner { email } } } }',
      );
      expect(result).toEqual({
        data: {
          users: [
            {
              tasks: [{ owner: { email: 'a@example.com' } }, { owner: { email: 'a@example.com' } }],
            },
          ],
        },
      });
      expect(statements).toHaveLength(1);
    }
  });

  describe('default resolveType', () => {
    function build(
      register: (
        builder: PothosSchemaTypes.SchemaBuilder<
          PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>
        >,
        task: ReturnType<typeof builderTask>,
      ) => void,
      resolveType?: () => string,
    ) {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [prismaNextPlugin],
        prismaNext: { contract },
      });
      const task = builderTask(builder, resolveType);
      register(builder, task);
      builder.queryType({
        fields: (t) => ({
          tasks: t.prismaField({
            type: [task],
            resolve: () => orm.Task.orderBy((row) => row.id.asc()),
          }),
        }),
      });
      return builder.toSchema();
    }

    it('routes rows to a variant registered under a custom name', async () => {
      const schema = build((builder, task) => {
        builder.prismaObject('Bug', {
          variant: 'BugReport',
          interfaces: [task],
          fields: () => ({}),
        });
        builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
      });
      const result = await graphql({
        schema,
        source: '{ tasks { __typename title } }',
        contextValue: {},
      });
      expect(result).toEqual({
        data: {
          tasks: [
            { __typename: 'BugReport', title: 'bug1' },
            { __typename: 'Feature', title: 'feat1' },
          ],
        },
      });
    });

    it('fails the build when a variant has no implementing type', () => {
      expect(() =>
        build((builder, task) => {
          builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
        }),
      ).toThrow(/variant model 'Feature' \('feature'\) has no implementing type/);
    });

    it('fails the build when a variant has several implementing types', () => {
      expect(() =>
        build((builder, task) => {
          builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
          builder.prismaObject('Bug', {
            variant: 'BugReport',
            interfaces: [task],
            fields: () => ({}),
          });
          builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
        }),
      ).toThrow(/variant model 'Bug' \('bug'\) has several implementing types \(Bug, BugReport\)/);
    });

    it('leaves routing to a resolveType the interface declares', () => {
      expect(() =>
        build(
          (builder, task) => {
            builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
          },
          () => 'Bug',
        ),
      ).not.toThrow();
    });
  });

  it('rejects a relation typed as a variant of another branch of its hierarchy', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
    const feature = builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('User', {
      fields: (t) => ({ reviews: t.relation('reviews', { type: feature as never }) }),
    });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => orm.User }) }),
    });
    expect(() => builder.toSchema()).toThrow(
      /t\.relation\('reviews'\) on 'User' targets model 'Bug' but its type is backed by model 'Feature'/,
    );
  });
});
