import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute, type GraphQLSchema, parse } from 'graphql';
import { afterAll, expect, it } from 'vitest';
import PrismaNextPlugin, { PrismaInterfaceRef } from '../src';
import {
  type CapturedExecution,
  createSqliteRuntime,
  loadContract,
  withCapture,
} from './fixtures/runtime';
import type { Contract } from './inheritance/contract';

const contract = loadContract<Contract>(new URL('./inheritance/contract.json', import.meta.url));
const db = createSqliteRuntime(
  contract,
  `
  CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
  CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
  CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL, code TEXT UNIQUE, championId TEXT);
  CREATE TABLE note (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, featureCode TEXT);
  INSERT INTO user VALUES ('u1', 'a@example.com');
  INSERT INTO task VALUES
    ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'),
    ('t2', 'feat1', 'feature', 'u1', NULL, NULL),
    ('t3', 'feat2', 'feature', 'u1', NULL, NULL);
  INSERT INTO feature VALUES ('t2', 5, 'f2', 'u1'), ('t3', 7, 'f3', 'u1');
  INSERT INTO note VALUES ('n1', 't1', NULL), ('n2', 't2', 'f2'), ('n3', 't3', 'f3');
`,
);
afterAll(() => db.cleanup());

type Context = { db: Pick<typeof db.client, 'orm'> };

async function run(schema: GraphQLSchema, source: string, context: Context = { db: db.client }) {
  const statements: CapturedExecution[] = [];
  const result = await withCapture(statements, async () =>
    execute({ schema, document: parse(source), contextValue: context }),
  );
  return { ...result, statements };
}

function createSchema(authFirst: boolean) {
  const observed: { stage: string; id: string; title: string; email: string }[] = [];
  const observe = (stage: string, row: { id: string; title: string; owner: { email: string } }) => {
    observed.push({ stage, id: row.id, title: row.title, email: row.owner.email });
    return true;
  };
  const builder = new SchemaBuilder<{
    PrismaContract: Contract;
    Context: Context;
    AuthScopes: { ok: boolean };
  }>({
    plugins: authFirst
      ? [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin]
      : [PrismaNextPlugin, RelayPlugin, ScopeAuthPlugin],
    relay: { nodesOnConnection: true },
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prisma: { client: (context) => context.db, context: db.client.context },
  });
  const Task = builder.prismaInterface('Task', {
    select: { title: true, owner: true },
    authScopes: (row) => observe('interface auth', row),
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.prismaObject('Bug', { interfaces: [Task], fields: () => ({}) });
  builder.prismaObject('Feature', {
    interfaces: [Task],
    select: { title: true, owner: true },
    authScopes: (row) => observe('object auth', row),
    fields: (t) => ({
      priority: t.exposeInt('priority'),
      ownerEmail: t.string({
        authScopes: (row) => observe('field auth', row),
        resolve: (row) => row.owner.email,
      }),
    }),
  });
  const FeatureLike = builder.prismaInterface('Feature', {
    variant: 'FeatureLike',
    select: { title: true, owner: true },
    resolveType: (row) => {
      observe('resolveType', row);
      return 'FeatureView';
    },
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.prismaObject('Feature', {
    variant: 'FeatureView',
    interfaces: [FeatureLike],
    select: { title: true, owner: true },
    authScopes: (row) => observe('view auth', row),
    fields: (t) => ({ priority: t.exposeInt('priority') }),
  });
  builder.prismaObject('Note', {
    fields: (t) => ({
      id: t.exposeID('id'),
      selected: t.field({
        type: Task,
        nullable: true,
        select: { feature: true },
        resolve: (row) => row.feature,
      }),
      dynamic: t.field({
        type: Task,
        nullable: true,
        select: () => ({ feature: true }),
        resolve: (row) => row.feature,
      }),
    }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      features: t.field({
        type: [Task],
        select: { championed: { orderBy: { id: 'asc' } } },
        resolve: (row) => row.championed,
      }),
      directFeatures: t.relation('championed', {
        type: FeatureLike,
        query: { orderBy: { id: 'asc' } },
      }),
      pagedFeatures: t.relatedConnection('championed', { type: FeatureLike }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      notes: t.prismaField({ type: ['Note'], query: { orderBy: { id: 'asc' } } }),
      users: t.prismaField({ type: ['User'] }),
    }),
  });
  return { schema: builder.toSchema(), observed };
}

const featureNodes = [
  { __typename: 'Feature', title: 'feat1', priority: 5, ownerEmail: 'a@example.com' },
  { __typename: 'Feature', title: 'feat2', priority: 7, ownerEmail: 'a@example.com' },
];

it.each([
  true,
  false,
])('hydrates interface results before auth with authFirst=%s', async (authFirst) => {
  const { schema, observed } = createSchema(authFirst);
  for (const field of ['selected', 'dynamic']) {
    observed.length = 0;
    const result = await run(
      schema,
      `{ notes { id ${field} { __typename title ... on Feature { priority ownerEmail } } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      notes: [
        { id: 'n1', [field]: null },
        { id: 'n2', [field]: featureNodes[0] },
        { id: 'n3', [field]: featureNodes[1] },
      ],
    });
    for (const stage of ['interface auth', 'object auth', 'field auth']) {
      expect(observed.filter((value) => value.stage === stage)).toEqual([
        { stage, id: 't2', title: 'feat1', email: 'a@example.com' },
        { stage, id: 't3', title: 'feat2', email: 'a@example.com' },
      ]);
    }
    // Initial relation query, one interface hydration batch and one concrete-type batch.
    expect(result.statements).toHaveLength(3);
  }
});

it('hydrates a to-many variant relation returned as the base interface', async () => {
  const { schema } = createSchema(true);
  const result = await run(
    schema,
    '{ users { features { __typename title ... on Feature { priority ownerEmail } } } }',
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ users: [{ features: featureNodes }] });
  expect(result.statements).toHaveLength(3);
});

it.each([
  'directFeatures',
  'pagedFeatures',
])('hydrates %s before its custom resolveType', async (field) => {
  const { schema, observed } = createSchema(true);
  const nodes = '__typename title ... on FeatureView { priority }';
  const selection =
    field === 'pagedFeatures'
      ? `${field}(first: 2) { nodes { ${nodes} } }`
      : `${field} { ${nodes} }`;
  const result = await run(schema, `{ users { ${selection} } }`);
  const values = [
    { __typename: 'FeatureView', title: 'feat1', priority: 5 },
    { __typename: 'FeatureView', title: 'feat2', priority: 7 },
  ];
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    users: [{ [field]: field === 'pagedFeatures' ? { nodes: values } : values }],
  });
  for (const stage of ['resolveType', 'view auth']) {
    expect(observed.filter((value) => value.stage === stage)).toEqual([
      { stage, id: 't2', title: 'feat1', email: 'a@example.com' },
      { stage, id: 't3', title: 'feat2', email: 'a@example.com' },
    ]);
  }
  expect(result.statements).toHaveLength(3);
});

it('uses the caller transaction for interface hydration and preserves rollback', async () => {
  const { schema, observed } = createSchema(true);
  const rollback = new Error('rollback native interface fixture');
  await expect(
    db.client.transaction(async (tx) => {
      await tx.orm.Task.where({ id: 't2' }).update({ title: 'uncommitted' });
      const result = await run(
        schema,
        '{ notes { id selected { __typename title ... on Feature { priority ownerEmail } } } }',
        { db: tx },
      );
      expect(result.errors).toBeUndefined();
      expect(result.data).toMatchObject({
        notes: [
          { selected: null },
          { selected: { title: 'uncommitted' } },
          { selected: { title: 'feat2' } },
        ],
      });
      expect(
        observed
          .filter((value) => value.id === 't2')
          .every((value) => value.title === 'uncommitted'),
      ).toBe(true);
      expect(result.statements).toHaveLength(3);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
  expect((await db.orm.Task.where({ id: 't2' }).first())?.title).toBe('feat1');
});

it.each(['union', 'non-model interface'])('retains the separate-table guard for a %s', (kind) => {
  const builder = new SchemaBuilder<{ PrismaContract: Contract; AuthScopes: { ok: boolean } }>({
    plugins: [ScopeAuthPlugin, PrismaNextPlugin],
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prisma: { client: db.client },
  });
  const Loose = builder.interfaceRef<{}>('Loose').implement({
    resolveType: () => 'Feature',
    fields: (t) => ({ priority: t.int({ resolve: () => 5 }) }),
  });
  const Feature = builder.prismaObject('Feature', {
    interfaces: [Loose],
    fields: (t) => ({ priority: t.exposeInt('priority') }),
  });
  const Union = builder.unionType('LooseUnion', { types: [Feature] });
  builder.prismaObject('Note', {
    fields: (t) => ({
      selected: t.field({
        type: kind === 'union' ? Union : Loose,
        nullable: true,
        select: { feature: true },
        resolve: (row) => row.feature,
      }),
    }),
  });
  builder.queryType({ fields: (t) => ({ notes: t.prismaField({ type: ['Note'] }) }) });
  expect(() => builder.toSchema()).toThrow(/loads the separate table of variant 'Feature'/);
});

it('hydrates variant-owned type selections before auth in batches', async () => {
  const observed: (string | undefined)[][] = [];
  const builder = new SchemaBuilder<{ PrismaContract: Contract; AuthScopes: { ok: boolean } }>({
    plugins: [ScopeAuthPlugin, PrismaNextPlugin],
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prisma: { client: db.client },
  });
  const Task = builder.prismaInterface('Task', {
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
  builder.prismaObject('Bug', {
    interfaces: [Task],
    select: { reviewer: true },
    authScopes: (row) => {
      observed.push(['bug', row.reviewer?.email]);
      return true;
    },
    fields: (t) => ({
      reviewerEmail: t.string({ nullable: true, resolve: (row) => row.reviewer?.email }),
    }),
  });
  builder.prismaObject('Feature', {
    interfaces: [Task],
    select: { champion: true },
    authScopes: (row) => {
      observed.push(['feature', row.champion?.email]);
      return true;
    },
    fields: (t) => ({
      championEmail: t.string({ nullable: true, resolve: (row) => row.champion?.email }),
    }),
  });
  builder.queryType({
    fields: (t) => ({ tasks: t.prismaField({ type: [Task], query: { orderBy: { id: 'asc' } } }) }),
  });
  const result = await run(
    builder.toSchema(),
    '{ tasks { __typename title ... on Bug { reviewerEmail } ... on Feature { championEmail } } }',
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    tasks: [
      { __typename: 'Bug', title: 'bug1', reviewerEmail: 'a@example.com' },
      { __typename: 'Feature', title: 'feat1', championEmail: 'a@example.com' },
      { __typename: 'Feature', title: 'feat2', championEmail: 'a@example.com' },
    ],
  });
  expect(observed).toEqual([
    ['bug', 'a@example.com'],
    ['feature', 'a@example.com'],
    ['feature', 'a@example.com'],
  ]);
  expect(result.statements).toHaveLength(3);
});

it.each([
  'relation',
  'connection',
])('rejects a model ref associated with a non-model interface in a %s', (kind) => {
  const builder = new SchemaBuilder<{ PrismaContract: Contract }>({
    plugins: [RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({}) },
    prisma: { client: db.client },
  });
  const Loose = builder.interfaceRef<{ priority: number }>('Loose').implement({
    resolveType: () => 'FeatureView',
    fields: (t) => ({ priority: t.int({ resolve: (row) => row.priority }) }),
  });
  builder.prismaObject('Feature', {
    variant: 'FeatureView',
    select: ['priority'],
    interfaces: [Loose],
    fields: (t) => ({ priority: t.exposeInt('priority') }),
  });
  // Public ref association can change the registered output without adding model hydration.
  type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaContract: Contract }>;
  const ref = new PrismaInterfaceRef<Types, 'Feature'>('FeatureRows', 'Feature');
  builder.configStore.associateParamWithRef(ref, Loose);
  builder.prismaObject('User', {
    fields: (t) => ({
      features:
        kind === 'relation'
          ? t.relation('championed', { type: ref })
          : t.relatedConnection('championed', { type: ref }),
    }),
  });
  builder.queryType({ fields: (t) => ({ users: t.prismaField({ type: ['User'] }) }) });
  expect(() => builder.toSchema()).toThrow(
    "Field 'User.features' returns interface 'Loose': relation 'championed' loads the separate table of variant 'Feature'",
  );
});
