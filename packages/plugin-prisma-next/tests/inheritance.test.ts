import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import { loadContract, run, useDatabase } from './fixtures/helpers';
import type { Contract } from './inheritance/contract';

const contract = loadContract<Contract>(new URL('./inheritance/contract.json', import.meta.url));
const db = useDatabase(
  contract,
  `
  CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
  CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
  CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL);
  INSERT INTO user VALUES ('u1', 'a@example.com');
  -- The feature row carries a reviewerId only Bug maps, so a relation to Bug must filter it out.
  INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'), ('t2', 'feat1', 'feature', 'u1', NULL, 'u1');
  INSERT INTO feature VALUES ('t2', 5);
  CREATE TABLE note (id TEXT PRIMARY KEY, taskId TEXT NOT NULL);
  INSERT INTO note VALUES ('n1', 't1'), ('n2', 't2');
`,
);

function createSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client: db.client },
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
        resolve: () => db.orm.Task.orderBy((row) => row.id.asc()),
      }),
      bugs: t.prismaField({ type: ['Bug'], resolve: () => db.orm.Task.variant('bug') }),
      unfilteredBugs: t.prismaField({ type: ['Bug'], resolve: () => db.orm.Bug as never }),
      baseAsBugs: t.prismaField({ type: ['Bug'], resolve: () => db.orm.Task as never }),
      featurePage: t.prismaConnection({
        type: 'Feature',
        cursor: 'id',
        resolve: () => db.orm.Task.variant('feature'),
      }),
      users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
    }),
  });
  return builder.toSchema();
}

function createVariantSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client: db.client },
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
    collection: () => db.orm.Task.variant('feature'),
    fields: (t) => ({ priority: t.exposeInt('priority') }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      email: t.exposeString('email'),
      tasks: t.relation('tasks', { query: { orderBy: (row) => row.id.asc() } }),
      bugs: t.relation('tasks', { type: bug }),
      bugPage: t.relatedConnection('tasks', {
        type: bug,
        cursor: 'id',
        totalCount: true,
      }),
      reviews: t.relation('reviews'),
    }),
  });
  builder.prismaObject('Note', {
    fields: (t) => ({
      id: t.exposeID('id'),
      bug: t.relation('task', { type: bug }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      tasks: t.prismaField({
        type: ['Task'],
        resolve: () => db.orm.Task.orderBy((row) => row.id.asc()),
      }),
      bugs: t.prismaField({ type: ['Bug'], resolve: () => db.orm.Task.variant('bug') }),
      users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
      notes: t.prismaField({
        type: ['Note'],
        resolve: () => db.orm.Note.orderBy((row) => row.id.asc()),
      }),
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

const email = 'a@example.com';

describe('native model inheritance', () => {
  it('routes interface rows by discriminator and plans variant fragments into one query', async () => {
    const result = await run(
      createSchema(),
      '{ tasks { __typename id owner { email } ... on Bug { severity } ... on Feature { priority } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.tasks).toEqual([
      { __typename: 'Bug', id: 't1', owner: { email }, severity: 'high' },
      { __typename: 'Feature', id: 't2', owner: { email }, priority: 5 },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('routes rows that select no discriminator-bearing field', async () => {
    const result = await run(
      createSchema(),
      '{ tasks { __typename } users { tasks { __typename title } } }',
    );
    expect(result.data).toEqual({
      tasks: [{ __typename: 'Bug' }, { __typename: 'Feature' }],
      users: [
        {
          tasks: [
            { __typename: 'Bug', title: 'bug1' },
            { __typename: 'Feature', title: 'feat1' },
          ],
        },
      ],
    });
  });

  it('loads a variant with its inherited fields and relations', async () => {
    const result = await run(
      createSchema(),
      '{ bugs { id title severity owner { email } } featurePage(first: 1) { edges { node { title priority } } } }',
    );
    expect(result.data).toEqual({
      bugs: [{ id: 't1', title: 'bug1', severity: 'high', owner: { email } }],
      featurePage: { edges: [{ node: { title: 'feat1', priority: 5 } }] },
    });
  });

  it.each([
    'unfilteredBugs',
    'baseAsBugs',
  ])('rejects %s, which would load other variants', async (field) => {
    const result = await run(createSchema(), `{ ${field} { id } }`);
    expect(result.errors?.[0]?.message).toMatch(/orm\.Task\.variant\('bug'\)/);
    expect(result.statements).toHaveLength(0);
  });

  it('fills variant fallbacks through the base collection', async () => {
    const result = await run(
      createSchema(),
      '{ tasks { id ... on Bug { owner { email } severity } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.tasks).toEqual([
      { id: 't1', owner: { email }, severity: 'high' },
      { id: 't2' },
    ]);
  });

  it('loads a relation a variant declares through orm.Task.variant()', async () => {
    const result = await run(createVariantSchema(), '{ bugs { title reviewer { email } } }');
    expect(result.data).toEqual({ bugs: [{ title: 'bug1', reviewer: { email } }] });
    expect(result.statements).toHaveLength(1);
  });

  it('loads a variant-declared relation beneath the base interface through the loader', async () => {
    const source = '{ tasks { title ... on Bug { reviewer { email } } } }';
    const result = await run(createVariantSchema(), source);
    expect(result.data).toEqual({
      tasks: [{ title: 'bug1', reviewer: { email } }, { title: 'feat1' }],
    });
    expect(result.statements).toHaveLength(2);
  });

  it('narrows a relation and connection typed as a variant to that variant', async () => {
    const result = await run(
      createVariantSchema(),
      `{ users {
        bugs { __typename title reviewer { email } }
        bugPage(first: 5) { totalCount edges { node { title } } }
      } }`,
    );
    expect(result.data.users).toEqual([
      {
        bugs: [{ __typename: 'Bug', title: 'bug1', reviewer: { email } }],
        bugPage: { totalCount: 1, edges: [{ node: { title: 'bug1' } }] },
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('resolves a to-one relation typed as a variant to null for rows of another variant', async () => {
    const schema = createVariantSchema();
    expect(printSchema(schema)).toContain('bug: Bug\n');
    const result = await run(schema, '{ notes { id bug { severity } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.notes).toEqual([
      { id: 'n1', bug: { severity: 'high' } },
      { id: 'n2', bug: null },
    ]);
  });

  it('filters a relation targeting a single-table variant by discriminator', async () => {
    const result = await run(createVariantSchema(), '{ users { reviews { title severity } } }');
    expect(result.data.users).toEqual([{ reviews: [{ title: 'bug1', severity: 'high' }] }]);
  });

  it('loads relations a variant target inherits through the loader', async () => {
    const source = '{ users { reviews { title owner { email } reviewer { email } } } }';
    const result = await run(createVariantSchema(), source);
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { reviews: [{ title: 'bug1', owner: { email }, reviewer: { email } }] },
    ]);
  });

  it('plans fragments on Node for the implementations that are nodes', async () => {
    const result = await run(createVariantSchema(), '{ tasks { __typename ... on Node { id } } }');
    expect(result.errors).toBeUndefined();
    const [bug, feature] = result.data.tasks;
    expect(bug).toEqual({ __typename: 'Bug' });
    expect(Buffer.from(feature.id, 'base64').toString()).toBe('Feature:t2');
    expect(result.statements).toHaveLength(1);
  });

  it('reports a node row without its id field', async () => {
    const result = await run(createVariantSchema(), '{ orphanFeature { id } }');
    expect(result.errors?.[0]?.message).toMatch(/identity field 'Feature\.id'/);
  });

  it('does not reload inherited fields the interface query loaded', async () => {
    const result = await run(createVariantSchema(), '{ users { tasks { owner { email } } } }');
    expect(result.data.users).toEqual([{ tasks: [{ owner: { email } }, { owner: { email } }] }]);
    expect(result.statements).toHaveLength(1);
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
        prismaNext: { client: db.client },
      });
      const task = builderTask(builder, resolveType);
      register(builder, task);
      builder.queryType({
        fields: (t) => ({
          tasks: t.prismaField({
            type: [task],
            resolve: () => db.orm.Task.orderBy((row) => row.id.asc()),
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
      const result = await run(schema, '{ tasks { __typename title } }');
      expect(result.data.tasks).toEqual([
        { __typename: 'BugReport', title: 'bug1' },
        { __typename: 'Feature', title: 'feat1' },
      ]);
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
      prismaNext: { client: db.client },
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
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    expect(() => builder.toSchema()).toThrow(
      /t\.relation\('reviews'\) on 'User' targets model 'Bug' but its type is backed by model 'Feature'/,
    );
  });

  it('rejects a relation typed as a model outside its hierarchy', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    const user = builder.prismaObject('User', {
      fields: (t) => ({ email: t.exposeString('email') }),
    });
    builder.prismaObjectField('User', 'tasks', (t) => t.relation('tasks', { type: user as never }));
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    expect(() => builder.toSchema()).toThrow(
      /t\.relation\('tasks'\) on 'User' targets model 'Task' but its type is backed by unrelated model 'User'/,
    );
  });

  it.each([
    [
      'names no variant',
      { id: 't9', title: 'plain', type: 'task' },
      /type="task", which names no variant of model 'Task'/,
    ],
    ['was loaded without', { id: 't1', title: 'bug1' }, /loaded without its discriminator 'type'/],
  ])('reports an interface row whose discriminator %s', async (_name, row, message) => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    const task = builderTask(builder);
    builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.queryType({
      fields: (t) => ({ task: t.field({ type: task, resolve: () => row as never }) }),
    });
    const result = await run(builder.toSchema(), '{ task { title } }');
    expect(result.errors?.[0].message).toMatch(message);
  });

  it("encodes a column a variant keeps in its own table through that column's codec", async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const pages = prismaConnectionHelpers(builder, 'Feature', { cursor: ['priority', 'id'] });
    const page = await pages.applyPagination(db.orm.Task.variant('feature'), {}, undefined, {});
    // The integer codec refuses a value it doesn't hold; without it the value encodes as is.
    const opaque = page.wrap([{ id: 't2', priority: { value: 'opaque' } } as never]);
    expect(() => opaque.pageInfo.endCursor).toThrow();
    expect(page.wrap([{ id: 't2', priority: 5 } as never]).pageInfo.endCursor).toEqual(
      expect.any(String),
    );
  });
});
