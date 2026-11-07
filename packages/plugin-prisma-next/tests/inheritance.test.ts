import { readFileSync } from 'node:fs';
import SchemaBuilder, { PothosSchemaError } from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import { GraphQLError, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import { getPluginConfig } from '../src/utils/config';
import { buildConnectionPage, connectionOrder } from '../src/utils/cursors';
import { detailOf } from './fixtures/errors';
import { loadContract, run, useDatabase } from './fixtures/helpers';
import type { Contract } from './inheritance/contract';

const contract = loadContract<Contract>(new URL('./inheritance/contract.json', import.meta.url));
const sql = `
  CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
  CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
  CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL, code TEXT UNIQUE, championId TEXT);
  INSERT INTO user VALUES ('u1', 'a@example.com');
  -- The feature row carries a reviewerId only Bug maps, so a relation to Bug must filter it out.
  INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'), ('t2', 'feat1', 'feature', 'u1', NULL, 'u1');
  INSERT INTO feature VALUES ('t2', 5, 'f2', 'u1');
  CREATE TABLE note (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, featureCode TEXT);
  INSERT INTO note VALUES ('n1', 't1', NULL), ('n2', 't2', 'f2');
`;
const db = useDatabase(contract, sql);

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
      tasks: t.relation('tasks', { query: { orderBy: { id: 'asc' } } }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      tasks: t.prismaField({
        type: ['Task'],
        resolve: () => db.orm.Task.orderBy((row) => row.id.asc()),
      }),
      bugs: t.prismaField({ type: ['Bug'], resolve: () => db.orm.Task.variant('bug') }),
      featurePage: t.prismaConnection({
        type: 'Feature',
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
  builder.prismaNode('Feature', {
    interfaces: [task],
    id: { field: 'id' },
    collection: () => db.orm.Task.variant('feature'),
    select: ['priority'],
    fields: (t) => ({
      priority: t.exposeInt('priority'),
      // Reads the type-level select only.
      typePriority: t.int({ resolve: (feature) => feature.priority }),
    }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      email: t.exposeString('email'),
      tasks: t.relation('tasks', { query: { orderBy: { id: 'asc' } } }),
      bugs: t.relation('tasks', { type: bug }),
      bugPage: t.relatedConnection('tasks', {
        type: bug,
        totalCount: true,
      }),
      newestBugs: t.relatedConnection('tasks', {
        type: bug,
        query: () => ({ orderBy: { id: 'desc' } }),
      }),
      reviews: t.relation('reviews'),
      // The selection beneath plans the rows as Bug, so they load narrowed to it.
      nestedBugs: t.field({
        type: [bug],
        select: (_args, _ctx, nestedSelection) => ({ tasks: nestedSelection() }),
        resolve: (user) => user.tasks,
      }),
      staticBugs: t.field({
        type: [bug],
        select: { tasks: true },
        resolve: (user) => user.tasks,
      }),
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

  it('reloads variants through the base collection', async () => {
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

  it.each([
    // The selection beneath is planned with the rows.
    ['nestedBugs', 'title severity reviewer { email }', { reviewer: { email } }],
    // The rows load with every column, but nothing beneath them.
    ['staticBugs', 'title severity', {}],
  ])("narrows a field select's to-many relation to the variant the field's type is (%s)", async (field, selection, more) => {
    const result = await run(createVariantSchema(), `{ users { ${field} { ${selection} } } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { [field]: [{ title: 'bug1', severity: 'high', ...more }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('pages a connection typed as a variant under the order its orderBy chose', async () => {
    const result = await run(
      createVariantSchema(),
      '{ users { newestBugs(first: 5) { pageInfo { endCursor } edges { node { title } } } } }',
    );
    expect(result.errors).toBeUndefined();
    const [{ newestBugs }] = result.data.users;
    expect(newestBugs.edges).toEqual([{ node: { title: 'bug1' } }]);
    expect(newestBugs.pageInfo.endCursor).toEqual(expect.any(String));
    expect(result.statements[0].sql).toMatch(/ORDER BY [^)]*"id" DESC/);
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

  it('narrows a to-one relation by its discriminator without a hierarchy interface', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    const bug = builder.prismaObject('Bug', {
      fields: (t) => ({ severity: t.exposeString('severity', { nullable: true }) }),
    });
    builder.prismaObject('Note', {
      fields: (t) => ({ id: t.exposeID('id'), bug: t.relation('task', { type: bug }) }),
    });
    builder.queryType({
      fields: (t) => ({
        notes: t.prismaField({
          type: ['Note'],
          resolve: () => db.orm.Note.orderBy((row) => row.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ notes { id bug { severity } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.notes).toEqual([
      { id: 'n1', bug: { severity: 'high' } },
      { id: 'n2', bug: null },
    ]);
    expect(result.statements).toHaveLength(1);
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

  it('plans a variant nested in a field-less fragment on Node in one statement', async () => {
    const schema = createVariantSchema();
    const direct = await run(schema, '{ tasks { ... on Feature { typePriority } } }');
    const nested = await run(
      schema,
      '{ tasks { ... on Node { ... on Feature { typePriority } } } }',
    );
    expect(nested.errors).toBeUndefined();
    expect(nested.data).toEqual(direct.data);
    expect(nested.data).toEqual({ tasks: [{}, { typePriority: 5 }] });
    expect(direct.statements).toHaveLength(1);
    expect(nested.statements).toHaveLength(1);
  });

  it("names the base collection a variant's reload needs when the client lacks it", async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: {
        context: db.client.context,
        client: () => ({ orm: { User: db.orm.User } }) as never,
      },
    });
    const bug = builder.prismaObject('Bug', {
      fields: (t) => ({ owner: t.relation('owner') }),
    });
    builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
    builder.queryType({
      fields: (t) => ({ bug: t.field({ type: bug, resolve: () => ({ id: 't1' }) }) }),
    });
    const result = await run(builder.toSchema(), '{ bug { owner { email } } }');
    expect(detailOf(result.errors?.[0])).toBe(
      "Bug.owner: prismaNext.client has no collection for 'Bug' (loaded through 'Task').",
    );
  });

  it("narrows a node's default collection to its variant", async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    builder.prismaNode('Bug', {
      id: { field: 'id' },
      fields: (t) => ({ severity: t.exposeString('severity') }),
    });
    builder.prismaNode('Feature', {
      id: { field: 'id' },
      fields: (t) => ({ priority: t.exposeInt('priority') }),
    });
    builder.queryType({});
    const id = (type: string, row: string) => Buffer.from(`${type}:${row}`).toString('base64');
    const result = await run(
      builder.toSchema(),
      'query ($ids: [ID!]!) { nodes(ids: $ids) { __typename ... on Bug { severity } ... on Feature { priority } } }',
      {
        variables: {
          ids: [id('Bug', 't1'), id('Bug', 't2'), id('Feature', 't2'), id('Feature', 't1')],
        },
      },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.nodes).toEqual([
      { __typename: 'Bug', severity: 'high' },
      null,
      { __typename: 'Feature', priority: 5 },
      null,
    ]);
  });

  it('does not reload inherited fields the interface query loaded', async () => {
    const result = await run(createVariantSchema(), '{ users { tasks { owner { email } } } }');
    expect(result.data.users).toEqual([{ tasks: [{ owner: { email } }, { owner: { email } }] }]);
    expect(result.statements).toHaveLength(1);
  });

  describe('component fragments on interfaces', () => {
    // Titled has no model and is implemented by Task itself, which supplies its field; Node has
    // no model and is implemented only by Task's implementations. Feature's type-level select is
    // the one a fragment entering it must carry.
    function createComponentSchema() {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [RelayPlugin, prismaNextPlugin],
        relay: {},
        prismaNext: { client: db.client },
      });
      const titled = builder.interfaceRef<object>('Titled').implement({
        fields: (t) => ({ title: t.string({ resolve: () => '' }) }),
      });
      const task = builder.prismaInterface('Task', {
        interfaces: [titled],
        fields: (t) => ({ title: t.exposeString('title'), owner: t.relation('owner') }),
      });
      const bug = builder.prismaNode('Bug', {
        interfaces: [titled, task],
        id: { field: 'id' },
        collection: () => db.orm.Task.variant('bug'),
        fields: (t) => ({ severity: t.exposeString('severity') }),
      });
      // Its field reads only what an implementation's type-level select loads.
      const prioritized = builder.interfaceRef<{ priority: number }>('Prioritized').implement({
        fields: (t) => ({ priority: t.int({ resolve: (row) => row.priority }) }),
      });
      builder.prismaNode('Feature', {
        interfaces: [titled, task, prioritized],
        id: { field: 'id' },
        collection: () => db.orm.Task.variant('feature'),
        select: ['priority'],
        fields: (t) => ({ typePriority: t.int({ resolve: (feature) => feature.priority }) }),
      });
      builder.prismaObject('User', {
        fields: (t) => ({
          email: t.exposeString('email'),
          tasks: t.relation('tasks', { query: { orderBy: { id: 'asc' } } }),
          bugs: t.relation('tasks', { type: bug }),
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
        }),
      });
      return builder.toSchema();
    }

    const fragments = `
      fragment TitledFields on Titled { title }
      fragment NodeFields on Node { id }
      fragment OwnerFields on User { email }
      fragment TaskCard on Task { ...TitledFields owner { ...OwnerFields } }
      fragment BugCard on Bug { ...TaskCard ...NodeFields severity }
      fragment FeatureCard on Feature { ...NodeFields typePriority }
    `;
    const bugId = Buffer.from('Bug:t1').toString('base64');
    const featureId = Buffer.from('Feature:t2').toString('base64');
    const bugCard = { title: 'bug1', owner: { email }, id: bugId, severity: 'high' };
    const schema = createComponentSchema();

    it('plans interface fragments spread into a concrete type in one statement', async () => {
      const result = await run(
        schema,
        `query { bugs { ...TitledFields ...TaskCard ...NodeFields } } ${fragments}`,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.bugs).toEqual([{ title: 'bug1', owner: { email }, id: bugId }]);
      expect(result.statements).toHaveLength(1);
    });

    it('plans nested spreads, and one fragment spread in several places, in one statement', async () => {
      const result = await run(
        schema,
        `query { users { ...OwnerFields bugs { ...BugCard } tasks { ...TaskCard ...BugCard ...FeatureCard } } } ${fragments}`,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toEqual([
        {
          email,
          bugs: [bugCard],
          tasks: [bugCard, { title: 'feat1', owner: { email }, id: featureId, typePriority: 5 }],
        },
      ]);
      expect(result.statements).toHaveLength(1);
    });

    it('plans a fragment on Node beneath the interface for the implementations', async () => {
      const result = await run(
        schema,
        `query { tasks { ...TitledFields ...NodeFields ... on Node { ... on Feature { typePriority } } } } ${fragments}`,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.tasks).toEqual([
        { title: 'bug1', id: bugId },
        { title: 'feat1', id: featureId, typePriority: 5 },
      ]);
      expect(result.statements).toHaveLength(1);
    });

    it("loads a model-less interface's field through a variant's type-level select", async () => {
      const result = await run(
        schema,
        'query { tasks { ...PrioritizedFields } } fragment PrioritizedFields on Prioritized { priority }',
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.tasks).toEqual([{}, { priority: 5 }]);
      expect(result.statements).toHaveLength(1);
    });

    it('plans interface fragments through node and nodes', async () => {
      const node = await run(schema, `query { node(id: "${bugId}") { ...BugCard } } ${fragments}`);
      expect(node.errors).toBeUndefined();
      expect(node.data.node).toEqual(bugCard);
      expect(node.statements).toHaveLength(1);

      const nodes = await run(
        schema,
        `query { nodes(ids: ["${bugId}", "${featureId}"]) { ...BugCard ...FeatureCard ...TitledFields } } ${fragments}`,
      );
      expect(nodes.errors).toBeUndefined();
      expect(nodes.data.nodes).toEqual([
        bugCard,
        { id: featureId, typePriority: 5, title: 'feat1' },
      ]);
      // One statement per type.
      expect(nodes.statements).toHaveLength(2);
    });

    it('plans a fragment beside direct fields on the same relation in one statement', async () => {
      const result = await run(
        schema,
        `query { users { tasks { title owner { email } } ...UserTasks } }
        fragment UserTasks on User { tasks { ...TaskCard ...NodeFields } } ${fragments}`,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toEqual([
        {
          tasks: [
            { title: 'bug1', owner: { email }, id: bugId },
            { title: 'feat1', owner: { email }, id: featureId },
          ],
        },
      ]);
      expect(result.statements).toHaveLength(1);
    });
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

    it.each([
      ['base first', false],
      ['variant first', true],
    ])('routes to a type implementing base and variant interfaces (%s)', async (_, reversed) => {
      const schema = build((builder, task) => {
        const bugFields = builder.prismaInterface('Bug', {
          variant: 'BugFields',
          interfaces: [task],
          resolveType: () => 'PlainBug',
          fields: (t) => ({ severity: t.exposeString('severity') }),
        });
        builder.objectType(builder.objectRef<{ id: string }>('PlainBug'), {
          interfaces: (reversed ? [bugFields, task] : [task, bugFields]) as never,
          fields: () => ({}),
        });
        builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
      });
      const result = await run(schema, '{ tasks { __typename ... on BugFields { severity } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.tasks).toEqual([
        { __typename: 'PlainBug', severity: 'high' },
        { __typename: 'Feature' },
      ]);
    });

    it('rejects a type implementing the interfaces of two variants', () => {
      expect(() =>
        build((builder, task) => {
          const variantFields = (model: 'Bug' | 'Feature') =>
            builder.prismaInterface(model, {
              name: `${model}Fields`,
              interfaces: [task],
              resolveType: () => 'Hybrid',
              fields: () => ({}),
            });
          builder.objectType(builder.objectRef<{ id: string }>('Hybrid'), {
            interfaces: [task, variantFields('Bug'), variantFields('Feature')] as never,
            fields: () => ({}),
          });
        }),
      ).toThrow(
        "'Hybrid' is of model 'Bug' but implements prismaInterface 'FeatureFields' of model 'Feature'. " +
          "A type can only implement the prismaInterfaces of its model and of its model's root.",
      );
    });

    it('rejects a variant type implementing the interface of another variant', () => {
      expect(() =>
        build((builder, task) => {
          const featureFields = builder.prismaInterface('Feature', {
            variant: 'FeatureFields',
            interfaces: [task],
            fields: () => ({}),
          });
          builder.prismaObject('Bug', {
            interfaces: [task, featureFields] as never,
            fields: () => ({}),
          });
        }),
      ).toThrow(
        "'Bug' is of model 'Bug' but implements prismaInterface 'FeatureFields' of model 'Feature'. " +
          "A type can only implement the prismaInterfaces of its model and of its model's root.",
      );
    });

    it('rejects a type of the root model implementing the interface of a variant', () => {
      expect(() =>
        build((builder, task) => {
          const bugFields = builder.prismaInterface('Bug', {
            variant: 'BugFields',
            interfaces: [task],
            fields: (t) => ({ severity: t.exposeString('severity') }),
          });
          builder.prismaObject('Bug', { interfaces: [task, bugFields], fields: () => ({}) });
          builder.prismaObject('Task', {
            variant: 'PlainTask',
            interfaces: [bugFields] as never,
            fields: () => ({}),
          });
          builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
        }),
      ).toThrow(
        "'PlainTask' is of model 'Task' but implements prismaInterface 'BugFields' of model 'Bug'. " +
          "A type can only implement the prismaInterfaces of its model and of its model's root.",
      );
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

    it('routes rows of an interface whose select is a column list', async () => {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [prismaNextPlugin],
        prismaNext: { client: db.client },
      });
      const task = builder.prismaInterface('Task', {
        select: ['title'],
        fields: (t) => ({ heading: t.string({ resolve: (row) => row.title.toUpperCase() }) }),
      });
      builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
      builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
      builder.queryType({
        fields: (t) => ({
          tasks: t.prismaField({
            type: [task],
            resolve: () => db.orm.Task.orderBy((row) => row.id.asc()),
          }),
        }),
      });
      const result = await run(builder.toSchema(), '{ tasks { __typename heading } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.tasks).toEqual([
        { __typename: 'Bug', heading: 'BUG1' },
        { __typename: 'Feature', heading: 'FEAT1' },
      ]);
      expect(result.statements).toHaveLength(1);
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

  describe("a field select's relation typed as a variant of another branch", () => {
    function variantBuilder(select: unknown) {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [prismaNextPlugin],
        prismaNext: { client: db.client },
      });
      const task = builder.prismaInterface('Task', {
        fields: (t) => ({ title: t.exposeString('title') }),
      });
      builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
      const feature = builder.prismaObject('Feature', {
        interfaces: [task],
        fields: (t) => ({ title: t.exposeString('title') }),
      });
      builder.prismaObject('User', {
        fields: (t) => ({
          reviewed: t.field({
            type: [feature],
            select: select as never,
            resolve: (user) => (user as never as { reviews: never[] }).reviews,
          }),
        }),
      });
      builder.queryType({
        fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
      });
      return builder;
    }

    it('rejects a static select when the schema is built', () => {
      expect(() => variantBuilder({ reviews: true }).toSchema()).toThrow(
        /Field 'User\.reviewed' targets model 'Bug' but its type is backed by model 'Feature'/,
      );
    });

    it("rejects the request of nestedSelection's entry", async () => {
      const schema = variantBuilder(
        (_args: unknown, _ctx: unknown, nestedSelection: () => unknown) => ({
          reviews: nestedSelection(),
        }),
      ).toSchema();
      const result = await run(schema, '{ users { reviewed { title } } }');
      expect(result.errors?.[0].message).toBe('Unexpected error.');
      expect(detailOf(result.errors?.[0])).toMatch(
        /Field 'User\.reviewed' targets model 'Bug' but its type is backed by model 'Feature'/,
      );
    });
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
      /discriminator 'type' that names no variant of model 'Task'/,
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
      // The row is invalid on purpose, so no type would accept it.
      fields: (t) => ({ task: t.field({ type: task, resolve: () => row as never }) }),
    });
    const result = await run(builder.toSchema(), '{ task { title } }');
    expect(detailOf(result.errors?.[0])).toMatch(message);
    // Logs often capture messages, so the row's value stays out of it.
    expect(result.errors?.[0].message).not.toContain('"task"');
    // A developer's error, which a server that masks errors hides from the client.
    expect(result.errors?.[0].originalError).toBeInstanceOf(Error);
    expect(result.errors?.[0].originalError).not.toBeInstanceOf(GraphQLError);
  });

  it('resolves connection helpers made before the model is registered as an interface', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const pages = prismaConnectionHelpers(builder, 'Task', {});
    const task = builderTask(builder);
    builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('User', {
      fields: (t) => ({
        tasks: t.connection({
          type: pages.ref,
          select: (args, ctx, nestedSelection) => ({
            tasks: pages.getQuery(args, ctx, nestedSelection),
          }),
          resolve: (user, args, ctx) => pages.resolve(user.tasks, args, ctx),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { tasks { edges { node { __typename title } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].tasks.edges).toEqual([
      { node: { __typename: 'Bug', title: 'bug1' } },
      { node: { __typename: 'Feature', title: 'feat1' } },
    ]);
  });

  it("loads the discriminator into an interface's planned rows when the query selects no field", async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const task = builder.prismaInterface('Task', {
      select: ['title'],
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    const tasks = prismaConnectionHelpers(builder, task, {});
    const loaded: { type?: string }[] = [];
    builder.prismaObject('User', {
      fields: (t) => ({
        taskPage: t.connection({
          type: task,
          select: (args, ctx, nestedSelection) => ({
            tasks: tasks.getQuery(args, ctx, nestedSelection),
          }),
          resolve: (user, args, ctx) => {
            loaded.push(...user.tasks);
            return tasks.resolve(user.tasks, args, ctx);
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { taskPage(first: 5) { edges { node { __typename } } } } }',
    );
    expect(result.errors).toBeUndefined();
    const typenames = {
      edges: [{ node: { __typename: 'Bug' } }, { node: { __typename: 'Feature' } }],
    };
    expect(result.data).toEqual({ users: [{ taskPage: typenames }] });
    // The interface's selection includes the discriminator even when only `__typename` is asked.
    expect(loaded.map((row) => row.type)).toEqual(['bug', 'feature']);
  });

  it.each([
    [
      'an interface after object fields',
      'object',
      'interface',
      'prismaObject or prismaObjectField(s) and then with prismaInterface',
    ],
    [
      'object fields after an interface',
      'interface',
      'object',
      'prismaInterface or prismaInterfaceField(s) and then with prismaObject',
    ],
  ] as const)('rejects a model used as %s', (_, first, then, message) => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    const use = (kind: 'interface' | 'object') =>
      kind === 'interface'
        ? builderTask(builder)
        : builder.prismaObjectFields('Task', (t) => ({ title: t.exposeString('title') }));
    use(first);
    expect(() => use(then)).toThrow(`Model 'Task' was used with ${message}`);
  });

  it("encodes a column a variant keeps in its own table through that column's codec", () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const config = getPluginConfig(builder);
    const plan = {
      order: connectionOrder(config.context, 'Feature')({ priority: 'asc' }),
      codecs: config.codecs('Feature'),
    };
    const wrap = (row: object) => buildConnectionPage([row as Record<string, unknown>], plan, {});
    // The integer codec refuses a value it doesn't hold; without it the value encodes as is.
    const opaque = wrap({ id: 't2', priority: { value: 'opaque' } });
    expect(() => opaque.pageInfo.endCursor).toThrow();
    expect(wrap({ id: 't2', priority: 5 }).pageInfo.endCursor).toEqual(expect.any(String));
  });
});

describe("a variant's relations in a field's select", () => {
  const email = 'a@example.com';

  function reviewBuilder() {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const task = builderTask(builder);
    builder.prismaObject('Feature', {
      interfaces: [task],
      fields: (t) => ({ priority: t.exposeInt('priority') }),
    });
    builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
    builder.queryType({
      fields: (t) => ({
        tasks: t.prismaField({
          type: ['Task'],
          resolve: () => db.orm.Task.orderBy((row) => row.id.asc()),
        }),
        bugs: t.prismaField({ type: ['Bug'], resolve: () => db.orm.Task.variant('bug') }),
      }),
    });
    return { builder, task };
  }

  function reviewedSchema() {
    const { builder, task } = reviewBuilder();
    builder.prismaObject('Bug', {
      interfaces: [task],
      fields: (t) => ({
        severity: t.exposeString('severity'),
        reviewerEmail: t.string({
          nullable: true,
          select: { reviewer: true },
          resolve: (bug) => bug.reviewer?.email,
        }),
      }),
    });
    return builder.toSchema();
  }

  function viaInterfaceSchema() {
    const { builder, task } = reviewBuilder();
    const Rev = builder.prismaInterface('Bug', {
      variant: 'Rev',
      fields: (t) => ({
        r: t.string({
          nullable: true,
          select: { reviewer: true },
          resolve: (bug) => bug.reviewer?.email,
        }),
      }),
    });
    builder.prismaObject('Bug', {
      interfaces: [task, Rev],
      fields: (t) => ({ severity: t.exposeString('severity') }),
    });
    return builder.toSchema();
  }

  it('loads in the one statement of a narrowed root', async () => {
    const result = await run(reviewedSchema(), '{ bugs { severity reviewerEmail } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ bugs: [{ severity: 'high', reviewerEmail: email }] });
    expect(result.statements).toHaveLength(1);
  });

  it('reloads through the variant beneath a root that is not narrowed', async () => {
    const result = await run(
      reviewedSchema(),
      '{ tasks { title ... on Bug { severity reviewerEmail } ... on Feature { priority } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      tasks: [
        { title: 'bug1', severity: 'high', reviewerEmail: email },
        { title: 'feat1', priority: 5 },
      ],
    });
    // One for the tasks, and one batch for the bug's fields.
    expect(result.statements).toHaveLength(2);
  });

  it('has fields of a variant interface reload beneath a root that is not narrowed', async () => {
    const result = await run(viaInterfaceSchema(), '{ tasks { ... on Rev { r } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ tasks: [{ r: email }, {}] });
    expect(result.statements).toHaveLength(2);
  });

  it("loads a variant interface's select with the type's own fields on a narrowed root", async () => {
    const schema = viaInterfaceSchema();
    const fields = await run(schema, '{ bugs { severity } }');
    expect(fields.errors).toBeUndefined();
    expect(fields.data).toEqual({ bugs: [{ severity: 'high' }] });
    expect(fields.statements).toHaveLength(1);
    const inherited = await run(schema, '{ bugs { r } }');
    expect(inherited.data).toEqual({ bugs: [{ r: email }] });
    expect(inherited.statements).toHaveLength(1);
  });

  it("reloads a computed value of a variant's to-many relation in a field's select", async () => {
    // Moves `notes` to the variant, which the fixture's schema has no room for: a to-many relation
    // needs a unique key on the variant.
    const json = JSON.parse(
      readFileSync(new URL('./inheritance/contract.json', import.meta.url), 'utf8'),
    );
    const { models } = json.domain.namespaces.__unbound__;
    models.Bug.relations.notes = models.Task.relations.notes;
    delete models.Task.relations.notes;
    const moved = contractFromJson(json) as unknown as Contract;
    const movedDb = useDatabase(moved, sql);
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: movedDb.client },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('Bug', {
      interfaces: [task],
      fields: (t) => ({
        noteTotal: t.int({
          select: { noteTotal: { notes: (sub) => sub.count() } },
          resolve: (bug) => bug.noteTotal,
        }),
      }),
    });
    builder.prismaObject('Feature', { interfaces: [task] });
    builder.queryType({
      fields: (t) => ({
        tasks: t.prismaField({
          type: ['Task'],
          resolve: () => movedDb.orm.Task.orderBy((row) => row.id.asc()),
        }),
        bugs: t.prismaField({ type: ['Bug'], resolve: () => movedDb.orm.Task.variant('bug') }),
      }),
    });
    const schema = builder.toSchema();
    const narrowed = await run(schema, '{ bugs { noteTotal } }');
    expect(narrowed.errors).toBeUndefined();
    expect(narrowed.data).toEqual({ bugs: [{ noteTotal: 1 }] });
    expect(narrowed.statements).toHaveLength(1);
    const result = await run(schema, '{ tasks { ... on Bug { noteTotal } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ tasks: [{ noteTotal: 1 }, {}] });
    expect(result.statements).toHaveLength(2);
  });

  it('reloads a computed value of a base relation beneath a relation targeting a variant', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('Bug', {
      interfaces: [task],
      select: { noteTotal: { notes: (sub) => sub.count() } },
      fields: (t) => ({ noteTotal: t.int({ resolve: (bug) => bug.noteTotal }) }),
    });
    builder.prismaObject('Feature', { interfaces: [task] });
    builder.prismaObject('User', { fields: (t) => ({ reviews: t.relation('reviews') }) });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    const result = await run(builder.toSchema(), '{ users { reviews { noteTotal } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ reviews: [{ noteTotal: 1 }] }] });
  });

  it("reloads a variant relation's computed value when a base relation's loaded", async () => {
    // Adds a to-many relation to the variant, which the fixture's schema has no room for.
    const json = JSON.parse(
      readFileSync(new URL('./inheritance/contract.json', import.meta.url), 'utf8'),
    );
    const { models } = json.domain.namespaces.__unbound__;
    models.Bug.relations.bugNotes = models.Task.relations.notes;
    const movedDb = useDatabase(contractFromJson(json) as unknown as Contract, sql);
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: movedDb.client },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('Bug', {
      interfaces: [task],
      select: { baseTotal: { notes: (sub) => sub.count() } },
      fields: (t) => ({
        noteTotal: t.int({
          // The contract's type doesn't have `bugNotes`.
          select: {
            noteTotal: { bugNotes: (sub: { count(): unknown }) => sub.count() },
          } as never,
          resolve: (bug) => (bug as unknown as { noteTotal: number }).noteTotal,
        }),
        baseTotal: t.int({ resolve: (bug) => bug.baseTotal }),
      }),
    });
    builder.prismaObject('Feature', { interfaces: [task] });
    builder.queryType({
      fields: (t) => ({
        tasks: t.prismaField({
          type: ['Task'],
          resolve: () => movedDb.orm.Task.orderBy((row) => row.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ tasks { ... on Bug { noteTotal baseTotal } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ tasks: [{ noteTotal: 1, baseTotal: 1 }, {}] });
  });
});

describe('a relation name two variants declare', () => {
  const json = JSON.parse(
    readFileSync(new URL('./inheritance/contract.json', import.meta.url), 'utf8'),
  );
  // Feature gets a `reviewer` like Bug's, through a column of its own table.
  const { models } = json.domain.namespaces.__unbound__;
  const { Bug, Feature } = models;
  Feature.fields.reviewerId = Bug.fields.reviewerId;
  Feature.storage.fields.reviewerId = Bug.storage.fields.reviewerId;
  Feature.relations.reviewer = Bug.relations.reviewer;
  json.storage.namespaces.__unbound__.entries.table.feature.columns.reviewerId =
    json.storage.namespaces.__unbound__.entries.table.task.columns.reviewerId;
  const sharedDb = useDatabase(
    contractFromJson(json) as unknown as Contract,
    sql
      .replace('championId TEXT)', 'championId TEXT, reviewerId TEXT)')
      .replace(
        "INSERT INTO feature VALUES ('t2', 5, 'f2', 'u1')",
        "INSERT INTO feature VALUES ('t2', 5, 'f2', 'u1', NULL)",
      ),
  );
  const createSharedBuilder = (bugFields: (t: never) => object = () => ({})) => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: sharedDb.client },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ id: t.exposeID('id'), owner: t.relation('owner') }),
    });
    builder.prismaObject('Bug', { interfaces: [task], fields: bugFields as never });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('User', {
      fields: (t) => ({ email: t.exposeString('email'), tasks: t.relation('tasks') }),
    });
    builder.queryType({
      fields: (t) => ({
        tasks: t.prismaField({
          type: ['Task'],
          resolve: () => sharedDb.orm.Task.orderBy((row) => row.id.asc()),
        }),
      }),
    });
    return builder;
  };

  it('leaves the rest of the hierarchy usable', async () => {
    const result = await run(
      createSharedBuilder().toSchema(),
      '{ tasks { __typename id owner { email tasks { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.tasks.map((task: { __typename: string }) => task.__typename)).toEqual([
      'Bug',
      'Feature',
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('rejects a field that loads the shared name when the schema is built', () => {
    const builder = createSharedBuilder(((t: { relation: (name: string) => unknown }) => ({
      reviewer: t.relation('reviewer'),
    })) as never);
    expect(() => builder.toSchema()).toThrow(
      new PothosSchemaError(
        "Relation 'reviewer' on model 'Bug' is declared under the same name by several variants of model 'Task', so it can't be loaded. Give it a name no other variant uses.",
      ),
    );
  });

  it('rejects a select that names the shared name when the schema is built', () => {
    const builder = createSharedBuilder(((t: { string: (options: object) => unknown }) => ({
      reviewer: t.string({
        nullable: true,
        select: { reviewer: true },
        resolve: () => null,
      }),
    })) as never);
    expect(() => builder.toSchema()).toThrow(
      "Relation 'reviewer' on a select of model 'Task' is declared under the same name by several variants",
    );
  });
});

describe('a relation targeting a variant model with a table of its own', () => {
  // The ORM loads Feature's rows through `orm.Feature`, which reads only the feature table, so
  // the fields reading Task's columns and relations reload them.
  function createFeatureSchema(database = db) {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: database.client },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title'), owner: t.relation('owner') }),
    });
    builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Feature', {
      interfaces: [task],
      fields: (t) => ({
        priority: t.exposeInt('priority'),
        champion: t.relation('champion', { nullable: true }),
        featureNotes: t.relation('featureNotes'),
      }),
    });
    builder.prismaObject('Note', {
      fields: (t) => ({
        id: t.exposeID('id'),
        feature: t.relation('feature', { nullable: true }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        email: t.exposeString('email'),
        championed: t.relation('championed'),
        championPage: t.relatedConnection('championed', {
          query: () => ({ orderBy: { id: 'asc' } }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        notes: t.prismaField({
          type: ['Note'],
          resolve: () => database.orm.Note.orderBy((row) => row.id.asc()),
        }),
        users: t.prismaField({ type: ['User'], resolve: () => database.orm.User }),
      }),
    });
    return builder.toSchema();
  }

  const feature = { title: 'feat1', priority: 5, owner: { email } };

  it('loads the base columns and relations of a to-one relation', async () => {
    const result = await run(
      createFeatureSchema(),
      '{ notes { id feature { title priority owner { email } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.notes).toEqual([
      { id: 'n1', feature: null },
      { id: 'n2', feature },
    ]);
    // The notes with their features, and the fields' reload.
    expect(result.statements).toHaveLength(2);
  });

  it('loads the base columns and relations of a to-many relation and connection', async () => {
    const result = await run(
      createFeatureSchema(),
      `{ users {
        championed { title priority owner { email } }
        championPage { edges { node { title priority } } }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        championed: [feature],
        championPage: { edges: [{ node: { title: 'feat1', priority: 5 } }] },
      },
    ]);
    // The users with their rows, and one batch reloading the fields of both.
    expect(result.statements).toHaveLength(2);
  });

  it("includes the variant's own relations and nests beneath them", async () => {
    const result = await run(
      createFeatureSchema(),
      '{ notes { feature { champion { email } featureNotes { id feature { title } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.notes[1]).toEqual({
      feature: { champion: { email }, featureNotes: [{ id: 'n2', feature: { title: 'feat1' } }] },
    });
    // The notes with what nests beneath, and the nested title's reload.
    expect(result.statements).toHaveLength(2);
  });

  describe("connection helpers whose nodes are a relation's rows", () => {
    function helperSchema() {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [RelayPlugin, prismaNextPlugin],
        relay: {},
        prismaNext: { client: db.client },
      });
      const task = builder.prismaInterface('Task', {
        fields: (t) => ({ title: t.exposeString('title'), owner: t.relation('owner') }),
      });
      builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
      builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
      builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
      const features = prismaConnectionHelpers(builder, 'Note', {
        query: () => ({ orderBy: { id: 'asc' } }),
        select: (nodeSelection) => ({ feature: nodeSelection() }),
        resolveNode: (note) => note.feature,
      });
      const Feature = builder.prismaObject('Feature', {
        interfaces: [task],
        fields: (t) => ({ priority: t.exposeInt('priority') }),
      });
      builder.prismaObjectField(Feature, 'noteFeatures', (t) =>
        t.connection({
          type: Feature,
          nodeNullable: true,
          select: (args, ctx, nestedSelection) => ({
            featureNotes: features.getQuery(args, ctx, nestedSelection),
          }),
          resolve: (feature, args, ctx) => features.resolve(feature.featureNotes, args, ctx),
        }),
      );
      builder.queryType({
        fields: (t) => ({
          features: t.prismaField({
            type: ['Feature'],
            resolve: () => db.orm.Task.variant('feature'),
          }),
        }),
      });
      return builder.toSchema();
    }

    it("loads the base columns of a variant's nodes in a relation's page", async () => {
      const result = await run(
        helperSchema(),
        '{ features { noteFeatures { edges { node { title priority owner { email } } } } } }',
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.features).toEqual([{ noteFeatures: { edges: [{ node: feature }] } }]);
      // The nodes, which read only the feature table, then one batch reloading them for the fields
      // reading Task.
      expect(result.statements).toHaveLength(2);
    });
  });

  function selectBuilder(
    plugins: (typeof ErrorsPlugin | typeof prismaNextPlugin)[] = [prismaNextPlugin],
  ) {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins,
      prismaNext: { client: db.client },
    });
    const feature = builder.prismaObject('Feature', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({
      fields: (t) => ({
        notes: t.prismaField({
          type: ['Note'],
          resolve: () => db.orm.Note.orderBy((row) => row.id.asc()),
        }),
      }),
    });
    return { builder, feature };
  }
  const rowsError =
    "the rows of relation 'feature', which targets variant model 'Feature' with a table of its own. Those rows load from that table alone, without the base model's columns. Return them as an object type of 'Feature' (t.relation, t.relatedConnection or a field select), or relate to the base model.";

  it("rejects a type's select that loads its rows when the schema is built", () => {
    const { builder } = selectBuilder();
    builder.prismaObject('Note', {
      select: { feature: true },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    expect(() => builder.toSchema()).toThrow(`The select of type 'Note' loads ${rowsError}`);
  });

  it("rejects a field's static select that reads its rows when the schema is built", () => {
    const { builder } = selectBuilder();
    builder.prismaObject('Note', {
      fields: (t) => ({
        featureTitle: t.string({
          nullable: true,
          select: { feature: true },
          resolve: (note) => note.feature?.title,
        }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(
      `The select of field 'Note.featureTitle' loads ${rowsError}`,
    );
  });

  it("rejects the request of a field's select function that reads its rows", async () => {
    const { builder } = selectBuilder();
    builder.prismaObject('Note', {
      fields: (t) => ({
        featureTitle: t.string({
          nullable: true,
          select: () => ({ feature: true }),
          resolve: (note) => note.feature?.title,
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ notes { featureTitle } }');
    expect(detailOf(result.errors?.[0])).toBe(
      `The select of field 'Note.featureTitle' loads ${rowsError}`,
    );
  });

  it('rejects a nested select that loads its rows when the schema is built', () => {
    const { builder } = selectBuilder();
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        featureTitles: t.stringList({
          select: { tasks: { select: { notes: { select: { feature: true } } } } },
          resolve: () => [],
        }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(
      `The select of field 'User.featureTitles' loads the rows of relation 'tasks', whose nested select loads the rows of relation 'notes', whose nested select loads ${rowsError}`,
    );
  });

  it("rejects the request of a select function's nested select that loads its rows", async () => {
    const { builder } = selectBuilder();
    builder.prismaObject('Note', {
      fields: (t) => ({
        featureTitle: t.string({
          nullable: true,
          select: () => ({ task: { select: { notes: { select: { feature: true } } } } }),
          resolve: () => null,
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ notes { featureTitle } }');
    expect(detailOf(result.errors?.[0])).toBe(
      `The select of field 'Note.featureTitle' loads the rows of relation 'task', whose nested select loads the rows of relation 'notes', whose nested select loads ${rowsError}`,
    );
  });

  it("plans the rows of a field's select for a field returning them", async () => {
    const { builder, feature } = selectBuilder();
    builder.prismaObject('Note', {
      fields: (t) => ({
        selected: t.field({
          type: feature,
          nullable: true,
          select: (_args, _ctx, nestedSelection) => ({ feature: nestedSelection() }),
          resolve: (note) => note.feature,
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ notes { selected { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.notes).toEqual([{ selected: null }, { selected: { title: 'feat1' } }]);
  });

  it("plans the rows of a field's select for a field returning a list of them", async () => {
    const { builder, feature } = selectBuilder();
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        selected: t.field({
          type: [feature],
          select: (_args, _ctx, nestedSelection) => ({ championed: nestedSelection() }),
          resolve: (user) => user.championed,
        }),
      }),
    });
    builder.queryField('users', (t) =>
      t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
    );
    const result = await run(builder.toSchema(), '{ users { selected { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([{ selected: [{ title: 'feat1' }] }]);
  });

  function taskBuilder() {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('Bug', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.queryType({
      fields: (t) => ({
        notes: t.prismaField({
          type: ['Note'],
          resolve: () => db.orm.Note.orderBy((row) => row.id.asc()),
        }),
        users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
      }),
    });
    return { builder, task };
  }

  // The rows load through `orm.Feature`, without Task's discriminator, which the interface's
  // resolveType reads before any field reloads them.
  it("rejects a field's static select that hands their rows to an interface", () => {
    const { builder, task } = taskBuilder();
    builder.prismaObject('Note', {
      fields: (t) => ({
        task: t.field({
          type: task,
          nullable: true,
          select: { feature: true },
          resolve: (note) => note.feature,
        }),
      }),
    });
    builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
    expect(() => builder.toSchema()).toThrow(`The select of field 'Note.task' loads ${rowsError}`);
  });

  it("rejects a field's static select that hands their rows to an interface list with others", () => {
    const { builder, task } = taskBuilder();
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        tasks: t.field({
          type: [task],
          select: { reviews: true, championed: true },
          resolve: (user) => [...user.reviews, ...user.championed],
        }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(
      "The select of field 'User.tasks' loads the rows of relation 'championed'",
    );
  });

  it("rejects a field's static select that hands their rows to a union", () => {
    const { builder } = taskBuilder();
    const union = builder.unionType('AnyTask', { types: ['Bug', 'Feature'] as never });
    builder.prismaObject('Note', {
      fields: (t) => ({
        task: t.field({
          type: union,
          nullable: true,
          select: { feature: true },
          resolve: (note) => note.feature as never,
        }),
      }),
    });
    builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
    expect(() => builder.toSchema()).toThrow(
      /The select of field 'Note.task' loads the rows of relation 'feature'/,
    );
  });

  // A select function's entries are only known when a request is planned.
  it('rejects the request of a select function that hands their rows to an interface', async () => {
    const { builder, task } = taskBuilder();
    builder.prismaObject('Note', {
      fields: (t) => ({
        task: t.field({
          type: task,
          nullable: true,
          select: () => ({ feature: true }),
          resolve: (note) => note.feature,
        }),
      }),
    });
    builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
    const result = await run(builder.toSchema(), '{ notes { task { title } } }');
    expect(detailOf(result.errors?.[0])).toMatch(
      /The select of field 'Note.task' loads the rows of relation 'feature'/,
    );
  });

  // A relation's `type` is a ref of its target model or of a variant of it, so only a field's
  // select returns the rows of relations targeting different variants as one type.
  it('resolves the rows of relations targeting different variants as their object types', async () => {
    const { builder } = taskBuilder();
    builder.prismaObject('Note', {
      fields: (t) => ({ feature: t.relation('feature', { nullable: true }) }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        reviews: t.relation('reviews'),
        championed: t.relation('championed'),
      }),
    });
    const result = await run(
      builder.toSchema(),
      `{
        users { reviews { __typename title } championed { __typename title } }
        notes { feature { __typename title } }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        {
          reviews: [{ __typename: 'Bug', title: 'bug1' }],
          championed: [{ __typename: 'Feature', title: 'feat1' }],
        },
      ],
      notes: [{ feature: null }, { feature: { __typename: 'Feature', title: 'feat1' } }],
    });
  });

  it.each([
    't.relation',
    't.relatedConnection',
  ] as const)('rejects %s returning an interface of their model', (helper) => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const featureLike = builder.prismaInterface('Feature', {
      fields: (t) => ({ priority: t.exposeInt('priority') }),
    });
    builder.prismaObject('Feature', {
      variant: 'Spec',
      interfaces: [featureLike],
      fields: () => ({}),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        championed:
          helper === 't.relation'
            ? t.relation('championed')
            : t.relatedConnection('championed', {}),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(
      "Field 'User.championed' returns interface 'Feature' for the rows of relation 'championed', which targets variant model 'Feature' with a table of its own.",
    );
  });

  // `User.reviews` targets Bug, which shares Task's table. Its rows load through `orm.Bug`, which
  // can't include Task's relations, before the interface's resolveType reads them.
  function bugInterfaceBuilder(helper: 't.relation' | 't.relatedConnection', ownSelect: boolean) {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: db.client },
    });
    const task = builder.prismaInterface('Task', {
      ...(ownSelect ? {} : { select: { owner: true } }),
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    const bugLike = builder.prismaInterface('Bug', {
      interfaces: [task],
      ...(ownSelect ? { select: { owner: true } } : {}),
      resolveType: () => 'PlainBug',
      fields: () => ({}),
    });
    builder.prismaObject('Bug', {
      variant: 'PlainBug',
      interfaces: [task, bugLike],
      fields: () => ({}),
    });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        reviews:
          helper === 't.relation' ? t.relation('reviews') : t.relatedConnection('reviews', {}),
      }),
    });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    return builder;
  }

  it.each([
    't.relation',
    't.relatedConnection',
  ] as const)("rejects %s returning a single-table variant's interface whose select loads a base relation", (helper) => {
    expect(() => bugInterfaceBuilder(helper, true).toSchema()).toThrow(
      "Field 'User.reviews' returns interface 'Bug', whose select loads base relation 'owner', for the rows of relation 'reviews', which targets variant model 'Bug'. Rows loaded through a variant model can't include the base model's relations. Return them as an object type, or read 'owner' in a field.",
    );
  });

  it("rejects returning a single-table variant's interface whose interface's select loads a base relation", () => {
    expect(() => bugInterfaceBuilder('t.relation', false).toSchema()).toThrow(
      "Field 'User.reviews' returns interface 'Bug', whose interface 'Task' has a select that loads base relation 'owner'",
    );
  });

  it("rejects returning a single-table variant's interface whose select computes over a base relation", () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    const task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    const bugLike = builder.prismaInterface('Bug', {
      interfaces: [task],
      select: { noteCount: { notes: (sub) => sub.count() } },
      resolveType: () => 'PlainBug',
      fields: () => ({}),
    });
    builder.prismaObject('Bug', {
      variant: 'PlainBug',
      interfaces: [task, bugLike],
      fields: () => ({}),
    });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', { fields: (t) => ({ reviews: t.relation('reviews') }) });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    expect(() => builder.toSchema()).toThrow(
      "Field 'User.reviews' returns interface 'Bug', whose select loads base relation 'notes'",
    );
  });

  // An object type's fields reload what its select can't load through the variant model.
  it("loads a single-table variant object type's select of a base relation through a relation", async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    const task = builder.prismaInterface('Task', {
      select: { owner: true },
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('Bug', {
      interfaces: [task],
      select: { owner: true },
      fields: (t) => ({ ownerEmail: t.string({ resolve: (bug) => bug.owner.email }) }),
    });
    builder.prismaObject('Feature', { interfaces: [task], fields: () => ({}) });
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', { fields: (t) => ({ reviews: t.relation('reviews') }) });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    const result = await run(builder.toSchema(), '{ users { reviews { title ownerEmail } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([{ reviews: [{ title: 'bug1', ownerEmail: email }] }]);
  });

  it("rejects a field's select returning them through another plugin's type", () => {
    // plugin-errors changes the field's type after this plugin's onOutputFieldConfig runs.
    const { builder, feature } = selectBuilder([ErrorsPlugin, prismaNextPlugin]);
    builder.prismaObject('Note', {
      fields: (t) => ({
        selected: t.field({
          type: feature,
          nullable: true,
          errors: {},
          select: { feature: true },
          resolve: (note) => note.feature,
        }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(
      `The select of field 'Note.selected' loads ${rowsError}`,
    );
  });

  it("builds a field's static select that computes values from them", async () => {
    const { builder } = selectBuilder();
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        championCount: t.int({
          select: { total: { championed: (sub) => sub.count() } },
          resolve: (user) => user.total,
        }),
      }),
    });
    builder.queryField('users', (t) =>
      t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
    );
    const result = await run(builder.toSchema(), '{ users { championCount } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([{ championCount: 1 }]);
  });
});
