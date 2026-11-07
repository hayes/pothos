// Type-level authScopes run before this plugin's resolver wrappers when ScopeAuthPlugin is listed
// first, so they read a row before any reload. A field returning a type must resolve to a row
// holding what the type's select loads, which the types enforce, so the checks see it.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute, type GraphQLSchema, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import PrismaNextPlugin from '../src';
import {
  type CapturedExecution,
  createSqliteRuntime,
  createTestRuntime,
  loadContract,
  type SampleContract,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';
import type { Contract as InheritanceContract } from './inheritance/contract';

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});

async function run(schema: GraphQLSchema, source: string) {
  const result = await execute({ schema, document: parse(source), contextValue: {} });
  return { ...result, data: result.data as Record<string, unknown> | null | undefined };
}

function createSchema(seen: unknown[]) {
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    AuthScopes: { ok: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prismaNext: { client: ctx.client },
  });
  const Node = builder.nodeInterfaceRef();
  const Post = builder.prismaNode('Post', {
    id: { field: 'id' },
    select: { title: true, author: true },
    authScopes: (post) => {
      seen.push([post.title, post.author?.firstName]);
      return true;
    },
    fields: (t) => ({ content: t.exposeString('content') }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      posts: t.relation('posts', { query: { where: { id: 'p-hello' } } }),
    }),
  });
  const fullRow = () => ctx.orm.Post.include('author').where({ id: 'p-hello' }).first();
  builder.queryType({
    fields: (t) => ({
      post: t.prismaField({
        type: Post,
        nullable: true,
        resolve: () => ctx.orm.Post.where({ id: 'p-hello' }),
      }),
      user: t.prismaField({
        type: 'User',
        nullable: true,
        resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
      postPage: t.prismaConnection({
        type: Post,
        resolve: () => ctx.orm.Post.where({ id: 'p-hello' }),
      }),
      // @ts-expect-error a row an ORM query loaded isn't planned; it reloads
      plainPost: t.field({ type: Post, nullable: true, resolve: fullRow }),
      branded: t.field({
        type: Node,
        nullable: true,
        resolve: async () => {
          const row = await fullRow();
          // @ts-expect-error a row an ORM query loaded isn't planned; it reloads
          return row && Post.addBrand(row);
        },
      }),
      unbranded: t.field({ type: Node, nullable: true, resolve: fullRow }),
    }),
  });
  return builder.toSchema();
}

describe('rows returned for a type with ScopeAuthPlugin listed first', () => {
  it.each([
    ['prismaField', '{ post { content } }'],
    ['t.relation', '{ user { posts { content } } }'],
    ['a connection', '{ postPage { edges { node { content } } } }'],
    ['a plain t.field', '{ plainPost { content } }'],
    ['a branded row in a Node field', '{ branded { ... on Post { content } } }'],
  ])('show type-level authScopes what the select loads, from %s', async (_name, source) => {
    const seen: unknown[] = [];
    const result = await run(createSchema(seen), source);
    expect(result.errors).toBeUndefined();
    expect(JSON.stringify(result.data)).toContain('Welcome.');
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen.map((entry) => JSON.stringify(entry)))).toEqual(
      new Set([JSON.stringify(['Hello, Pothos', 'Alice'])]),
    );
  });

  it("can't resolve an unbranded row in a Node field", async () => {
    const result = await run(createSchema([]), '{ unbranded { id } }');
    expect(result.errors?.[0]?.message).toMatch(/must resolve/);
  });
});

const inheritance = loadContract<InheritanceContract>(
  new URL('./inheritance/contract.json', import.meta.url),
);
const inheritanceDb = createSqliteRuntime(
  inheritance,
  `
  CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
  CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
  CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL, code TEXT UNIQUE, championId TEXT);
  CREATE TABLE note (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, featureCode TEXT);
  INSERT INTO user VALUES ('u1', 'a@example.com'), ('u2', 'b@example.com');
  INSERT INTO task VALUES
    ('t1', 'bug1', 'bug', 'u1', 'high', 'u2'),
    ('t2', 'bug2', 'bug', 'u2', 'low', 'u1'),
    ('t3', 'feat1', 'feature', 'u1', NULL, 'u1');
  INSERT INTO feature VALUES ('t3', 5, 'f3', NULL);
  INSERT INTO note VALUES ('n1', 't3', 'f3'), ('n2', 't1', NULL);
`,
);
afterAll(() => inheritanceDb.cleanup());

// `User.reviews` targets the variant model Bug, whose rows load through `orm.Bug`. It can't include
// Task's relations, such as `owner`, so scope-auth's checks reload the rows with them.
function createVariantSchema(seen: unknown[], ownerSelectedOn: 'Bug' | 'Task') {
  const builder = new SchemaBuilder<{
    PrismaNextContract: InheritanceContract;
    AuthScopes: { ok: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prismaNext: { client: inheritanceDb.client },
  });
  const Task = builder.prismaInterface('Task', {
    select: ownerSelectedOn === 'Task' ? { owner: true } : {},
    fields: (t) => ({ title: t.exposeString('title'), owner: t.relation('owner') }),
  });
  builder.prismaObject('Bug', {
    interfaces: [Task],
    select: ownerSelectedOn === 'Bug' ? { owner: true } : {},
    authScopes: (bug) => {
      seen.push([bug.id, (bug as { owner?: { email: string } }).owner?.email]);
      return true;
    },
    fields: (t) => ({ severity: t.exposeString('severity') }),
  });
  builder.prismaObject('Feature', { interfaces: [Task], fields: () => ({}) });
  builder.prismaObject('User', {
    fields: (t) => ({
      email: t.exposeString('email'),
      reviews: t.relation('reviews'),
      reviewPage: t.relatedConnection('reviews', { query: () => ({ orderBy: { id: 'asc' } }) }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        resolve: () => inheritanceDb.orm.User.orderBy((row) => row.id.asc()),
      }),
    }),
  });
  return builder.toSchema();
}

describe('rows of a relation to a variant model with ScopeAuthPlugin listed first', () => {
  it.each([
    ['Bug', 't.relation', '{ users { reviews { title severity } } }'],
    ['Task', 't.relation', '{ users { reviews { title severity } } }'],
    ['Bug', 't.relatedConnection', '{ users { reviewPage { edges { node { title } } } } }'],
  ] as const)("show type-level authScopes the base relations %s's select loads, through %s", async (on, _field, source) => {
    const seen: unknown[] = [];
    const statements: CapturedExecution[] = [];
    const result = await withCapture(statements, () => run(createVariantSchema(seen, on), source));
    expect(result.errors).toBeUndefined();
    expect(JSON.stringify(result.data)).toContain('bug2');
    expect(seen).toEqual([
      ['t2', 'b@example.com'],
      ['t1', 'a@example.com'],
    ]);
    // The users with their reviews, one batch loading every review's owner for the checks, and one
    // for the fields.
    expect(statements).toHaveLength(3);
  });

  it('still resolves the relation as a field of the rows', async () => {
    const seen: unknown[] = [];
    const result = await run(
      createVariantSchema(seen, 'Task'),
      '{ users { reviews { title owner { email } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        { reviews: [{ title: 'bug2', owner: { email: 'b@example.com' } }] },
        { reviews: [{ title: 'bug1', owner: { email: 'a@example.com' } }] },
      ],
    });
    expect(seen).toEqual([
      ['t2', 'b@example.com'],
      ['t1', 'a@example.com'],
    ]);
  });
});

// `Note.feature` is a to-one relation targeting the variant model Feature, whose rows load through
// `orm.Feature`, which reads only the feature table, so it can't read Task's columns or include its
// relations.
function createToOneVariantSchema(seen: unknown[]) {
  const builder = new SchemaBuilder<{
    PrismaNextContract: InheritanceContract;
    AuthScopes: { ok: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prismaNext: { client: inheritanceDb.client },
  });
  const Task = builder.prismaInterface('Task', {
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.prismaObject('Bug', { interfaces: [Task], fields: () => ({}) });
  builder.prismaObject('Feature', {
    interfaces: [Task],
    select: { title: true, owner: true },
    authScopes: (feature) => {
      seen.push([feature.id, feature.title, feature.owner?.email]);
      return true;
    },
    fields: (t) => ({
      priority: t.exposeInt('priority'),
      ownerEmail: t.string({ nullable: true, resolve: (feature) => feature.owner?.email }),
    }),
  });
  builder.prismaObject('Note', {
    fields: (t) => ({
      id: t.exposeID('id'),
      feature: t.relation('feature', { nullable: true }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      notes: t.prismaField({
        type: ['Note'],
        resolve: () => inheritanceDb.orm.Note.orderBy((row) => row.id.asc()),
      }),
    }),
  });
  return builder.toSchema();
}

describe('a to-one relation to a variant model with a table of its own', () => {
  it("shows type-level authScopes the base columns and relations the variant's select loads", async () => {
    const seen: unknown[] = [];
    const statements: CapturedExecution[] = [];
    const result = await withCapture(statements, () =>
      run(createToOneVariantSchema(seen), '{ notes { id feature { priority ownerEmail } } }'),
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      notes: [
        { id: 'n1', feature: { priority: 5, ownerEmail: 'a@example.com' } },
        { id: 'n2', feature: null },
      ],
    });
    expect(seen).toEqual([['t3', 'feat1', 'a@example.com']]);
    // The notes with their features, one batch loading Task's columns and relations for the checks,
    // and one for the fields.
    expect(statements).toHaveLength(3);
  });
});
