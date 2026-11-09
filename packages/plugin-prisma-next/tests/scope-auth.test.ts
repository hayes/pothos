// biome-ignore-all lint/suspicious/noExplicitAny: the shared-walk schema names variants in loops
import SchemaBuilder, {
  BasePlugin,
  isThenable,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin, { type ScopeAuthParentLoader } from '@pothos/plugin-scope-auth';
import { SqlQueryError } from '@prisma/orm-family-sql/errors';
import {
  execute,
  experimentalExecuteIncrementally,
  GraphQLDeferDirective,
  type GraphQLFieldResolver,
  type GraphQLSchema,
  parse,
  specifiedDirectives,
  subscribe,
} from 'graphql';
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import PrismaNextPlugin, { type PothosPrismaNextPlugin, prismaConnectionHelpers } from '../src';
import { detailOf } from './fixtures/errors';
import {
  type CapturedExecution,
  createSqliteRuntime,
  createTestRuntime,
  loadContract,
  type SampleContract,
  type SqliteRuntime,
  sampleDdl,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';
import type { Contract as InheritanceContract } from './inheritance/contract';

let ctx: TestRuntimeContext;
let inheritanceDb: SqliteRuntime<InheritanceContract>;
beforeAll(async () => {
  ctx = await createTestRuntime();
  inheritanceDb = createSqliteRuntime(
    loadContract<InheritanceContract>(new URL('./inheritance/contract.json', import.meta.url)),
    `
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
    CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
    CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL, code TEXT UNIQUE, championId TEXT);
    INSERT INTO user VALUES ('u1', 'a@example.com');
    INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'), ('t2', 'feat1', 'feature', 'u1', NULL, 'u1');
    INSERT INTO feature VALUES ('t2', 5, NULL, 'u1');
  `,
  );
});
afterAll(async () => {
  await ctx?.cleanup();
  await inheritanceDb?.cleanup();
});

async function runCaptured(schema: GraphQLSchema, source: string) {
  const statements: CapturedExecution[] = [];
  const result = await withCapture(statements, async () =>
    execute({ schema, document: parse(source), contextValue: {} }),
  );
  return { ...result, data: result.data as any, statements };
}

function schema() {
  const builder = new SchemaBuilder<{
    PrismaContract: SampleContract;
    Context: { admin: boolean };
    AuthScopes: { admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: ({ admin }) => ({ admin }) },
    prisma: { client: ctx.client },
  });
  const AdminView = builder.prismaObject('User', {
    variant: 'AdminView',
    fields: (t) => ({ email: t.exposeString('email') }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      // t.variant takes other plugins' field options.
      adminView: t.variant(AdminView, { nullable: true, authScopes: { admin: true } }),
      email: t.withAuth({ admin: true }).exposeString('email', { nullable: true }),
      posts: t.withAuth({ admin: true }).relation('posts', { nullable: true }),
      postCount: t.withAuth({ admin: true }).relationCount('posts'),
      postConnection: t.withAuth({ admin: true }).relatedConnection('posts', { nullable: true }),
    }),
  });
  builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
  builder.queryType({
    fields: (t) => ({
      user: t.prismaField({
        type: 'User',
        collection: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
      privateUser: t.withAuth({ admin: true }).prismaField({
        type: 'User',
        nullable: true,
        collection: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
    }),
  });
  return builder.toSchema();
}

it('preserves selections and scope checks on prisma-specific field helpers', async () => {
  const result = await execute({
    schema: schema(),
    document: parse(
      '{ user { email adminView { email } posts { title } postCount postConnection(first: 1) { edges { node { title } } } } }',
    ),
    contextValue: { admin: true },
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    user: {
      email: 'alice@example.com',
      adminView: { email: 'alice@example.com' },
      posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
      postCount: 2,
      postConnection: { edges: [{ node: { title: 'Draft #1' } }] },
    },
  });
});

it('denies protected model fields without affecting the public sibling', async () => {
  const result = await execute({
    schema: schema(),
    document: parse(
      '{ user { firstName email adminView { email } posts { title } postConnection { edges { node { title } } } } }',
    ),
    contextValue: { admin: false },
  });
  expect(result.errors).toHaveLength(4);
  expect(result.data).toEqual({
    user: {
      firstName: 'Alice',
      email: null,
      adminView: null,
      posts: null,
      postConnection: null,
    },
  });
});

it('denies a protected count, which is never null, by nulling its parent', async () => {
  const result = await execute({
    schema: schema(),
    document: parse('{ user { firstName postCount } }'),
    contextValue: { admin: false },
  });
  expect(result.errors?.map((error) => error.path)).toEqual([['user', 'postCount']]);
  expect(result.data).toEqual({ user: null });
});

it('does not execute the root collection when a root scope denies access', async () => {
  const statements: CapturedExecution[] = [];
  const result = await withCapture(statements, async () =>
    execute({
      schema: schema(),
      document: parse('{ privateUser { firstName } }'),
      contextValue: { admin: false },
    }),
  );
  expect(result.errors).toHaveLength(1);
  expect(result.data).toEqual({ privateUser: null });
  expect(statements).toHaveLength(0);
});

function _narrowedParentShapeSurvivesWithAuth() {
  const builder = new SchemaBuilder<{
    PrismaContract: SampleContract;
    Context: { admin: boolean };
    AuthScopes: { admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: ({ admin }) => ({ admin }) },
    prisma: { client: ctx.client },
  });

  builder.prismaObjectFields('User', (t) => ({
    declaredBehindScope: t.withAuth({ admin: true }).string({
      select: ['email'],
      resolve: (row) => row.email,
    }),
    undeclaredBehindScope: t.withAuth({ admin: true }).string({
      // @ts-expect-error the string form's parent carries only declared dependencies
      resolve: (row) => row.email,
    }),
  }));
}

// A field's select widens the parent of its resolve only. Every other option, such as
// `authScopes`, runs before the field's select loads, so it sees the type's select alone.
function _fieldSelectWidensResolveOnly() {
  const builder = new SchemaBuilder<{
    PrismaContract: SampleContract;
    AuthScopes: { admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({ admin: true }) },
    prisma: { client: ctx.client },
  });
  const Post = builder.prismaObject('Post', {
    select: { title: true, author: true },
    fields: (t) => ({ id: t.exposeID('id') }),
  });
  const Comment = builder.prismaObject('Comment', { fields: (t) => ({ id: t.exposeID('id') }) });
  const helper = prismaConnectionHelpers(builder, Comment, {});
  builder.prismaObjectFields(Post, (t) => ({
    field: t.field({
      type: 'String',
      select: { content: true, comments: true },
      authScopes: (post) => {
        post.title.toUpperCase();
        post.author.firstName.toUpperCase();
        // @ts-expect-error the field's select loads after authScopes run
        post.content;
        // @ts-expect-error the field's select loads after authScopes run
        post.comments;
        return true;
      },
      grantScopes: (post) => {
        // @ts-expect-error the field's select loads after grantScopes run
        post.comments;
        return [];
      },
      resolve: (post) => `${post.title} ${post.content} ${post.comments.length}`,
    }),
    string: t.string({
      select: ['content'],
      authScopes: (post) => {
        // @ts-expect-error the field's select loads after authScopes run
        post.content;
        return { admin: post.title !== '' };
      },
      resolve: (post) => post.content ?? '',
    }),
    stringList: t.stringList({
      select: { comments: true },
      // @ts-expect-error the field's select loads after authScopes run
      authScopes: (post) => post.comments.length > 0,
      resolve: (post) => post.comments.map((comment) => comment.id),
    }),
    withAuth: t.withAuth({ admin: true }).string({
      select: ['content'],
      // @ts-expect-error the field's select loads after authScopes run
      authScopes: (post) => post.content !== null,
      resolve: (post) => post.content ?? '',
    }),
    connection: t.connection({
      type: Comment,
      select: (args, ctx, nestedSelection) => ({
        comments: helper.getQuery(args, ctx, nestedSelection),
      }),
      authScopes: (post) => {
        // @ts-expect-error the field's select loads after authScopes run
        post.comments;
        return post.author.id !== '';
      },
      resolve: (post, args, context) => helper.resolve(post.comments, args, context),
    }),
    prismaField: t.prismaField({
      type: 'User',
      select: { content: true },
      authScopes: (post) => {
        // @ts-expect-error the field's select loads after authScopes run
        post.content;
        return true;
      },
      collection: (post) =>
        (post.content ? ctx.orm.User.where({ id: post.author.id }) : null) as never,
    }),
    relation: t.relation('comments', { authScopes: (post) => post.title !== '' }),
    relationCount: t.relationCount('comments', { authScopes: (post) => post.title !== '' }),
    relatedConnection: t.relatedConnection('comments', {
      authScopes: (post) => post.author.id !== '',
    }),
    exposed: t.exposeString('title', { authScopes: (post) => post.author.id !== '' }),
  }));
}

it('loads declared columns and the exposed column for authScopes', async () => {
  const seen: Record<string, unknown> = {};
  const builder = new SchemaBuilder<{
    PrismaContract: SampleContract;
    AuthScopes: { open: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({ open: true }) },
    prisma: { client: ctx.client },
  });
  builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.prismaObject('User', {
    select: ['email'],
    fields: (t) => ({
      posts: t.relation('posts', {
        authScopes: (user) => {
          seen.relationEmail = user.email;
          return true;
        },
      }),
      firstName: t.exposeString('firstName', {
        authScopes: (user) => {
          seen.exposedOwn = user.firstName;
          seen.exposedDeclared = user.email;
          // @ts-expect-error lastName isn't loaded for this field
          seen.undeclared = user.lastName;
          return true;
        },
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        collection: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
    }),
  });
  const result = await execute({
    schema: builder.toSchema(),
    document: parse('{ users { firstName posts { id } } }'),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(seen).toEqual({
    relationEmail: 'alice@example.com',
    exposedOwn: 'Alice',
    exposedDeclared: 'alice@example.com',
    undeclared: undefined,
  });
});

const orders = [
  ['scope-auth first', [ScopeAuthPlugin, PrismaNextPlugin]],
  ['prismaNext first', [PrismaNextPlugin, ScopeAuthPlugin]],
] as const;

describe.each(orders)("the type's parent loader (%s)", (_, plugins) => {
  it('is added to prisma object types for scope-auth', () => {
    const builder = new SchemaBuilder<{
      PrismaContract: InheritanceContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: inheritanceDb.client },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    const schema = builder.toSchema();
    expect(schema.getType('User')?.extensions?.pothosScopeAuthParent).toBeTypeOf('function');
  });
});

describe.each(orders)("an implementation's select under an interface (%s)", (_, plugins) => {
  function variantSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaContract: InheritanceContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: inheritanceDb.client },
    });
    const Task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title', { nullable: true }) }),
    });
    builder.prismaObject('Bug', {
      interfaces: [Task],
      select: ['severity'],
      authScopes: (bug) => {
        seen.push(bug.severity);
        return bug.severity !== 'high';
      },
    });
    builder.prismaObject('Feature', {
      interfaces: [Task],
      select: ['priority'],
      authScopes: (feature) => {
        seen.push(feature.priority);
        return feature.priority === 5;
      },
    });
    builder.prismaObject('User', { fields: (t) => ({ tasks: t.relation('tasks') }) });
    builder.queryType({
      fields: (t) => ({
        tasks: t.prismaField({
          type: [Task],
          collection: () => inheritanceDb.orm.Task.orderBy((row) => row.id.asc()),
        }),
        users: t.prismaField({ type: ['User'], collection: () => inheritanceDb.orm.User }),
      }),
    });
    return builder.toSchema();
  }

  it('loads variant columns that type-level authScopes read, without a fragment', async () => {
    const seen: unknown[] = [];
    const schema = variantSchema(seen);
    const result = await runCaptured(schema, '{ tasks { __typename title } }');
    expect(seen).not.toContain(undefined);
    expect(seen).toContain('high');
    expect(seen).toContain(5);
    expect(result.data).toEqual({
      tasks: [
        { __typename: 'Bug', title: null },
        { __typename: 'Feature', title: 'feat1' },
      ],
    });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for Bug',
    ]);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).toMatch(/"severity"/);
    expect(result.statements[0].sql).toMatch(/"priority"/);

    const relation = await runCaptured(schema, '{ users { tasks { title } } }');
    expect(relation.data).toEqual({ users: [{ tasks: [{ title: null }, { title: 'feat1' }] }] });
    expect(relation.statements).toHaveLength(1);
    expect(seen).not.toContain(undefined);
  });

  function sameModelSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      resolveType: () => 'User',
      fields: (t) => ({ firstName: t.exposeString('firstName', { nullable: true }) }),
    });
    builder.prismaObject('User', {
      interfaces: [Named],
      select: { email: true, posts: true },
      authScopes: (user) => {
        seen.push(Array.isArray(user.posts) ? [user.email, user.posts.length] : user.posts);
        return user.email !== 'alice@example.com';
      },
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        named: t.prismaField({
          type: [Named],
          collection: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  it("loads an implementation's columns and to-many relations for its authScopes", async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(sameModelSchema(seen), '{ named { firstName } }');
    expect(result.data).toEqual({ named: [{ firstName: null }, { firstName: 'Bob' }] });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for User',
    ]);
    expect(seen).toEqual(
      expect.arrayContaining([
        ['alice@example.com', 2],
        ['bob@example.com', 2],
      ]),
    );
    expect(seen.every(Array.isArray)).toBe(true);
    expect(result.statements).toHaveLength(1);
  });
});

it.each(
  orders,
)("reloads a hand-built row for an implementation's authScopes (%s)", async (_, plugins) => {
  const seen: unknown[] = [];
  const builder = new SchemaBuilder<{
    PrismaContract: SampleContract;
    AuthScopes: { ok: boolean };
  }>({
    plugins: [...plugins],
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prisma: { client: ctx.client },
  });
  const Named = builder.prismaInterface('User', {
    variant: 'Named',
    resolveType: () => 'User',
    fields: (t) => ({ firstName: t.exposeString('firstName', { nullable: true }) }),
  });
  builder.prismaObject('User', {
    interfaces: [Named],
    select: ['email'],
    authScopes: (user) => {
      seen.push(user.email);
      return user.email !== 'alice@example.com';
    },
  });
  builder.queryType({
    fields: (t) => ({
      named: t.field({
        type: Named,
        resolve: () => ({ id: 'u-alice', firstName: 'Alice' }) as never,
      }),
    }),
  });
  const result = await runCaptured(builder.toSchema(), '{ named { firstName } }');
  expect(seen).toEqual(['alice@example.com']);
  expect(result.data).toEqual({ named: { firstName: null } });
  expect(result.statements).toHaveLength(1);
});

describe.each(
  orders,
)("a type select's to-many relation loaded through combine (%s)", (_, plugins) => {
  it('hands type-level authScopes the rows the type selects, once per parent', async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    builder.prismaObject('User', {
      select: { posts: true },
      authScopes: (user) => {
        seen.push(
          Array.isArray(user.posts) ? user.posts.map((post) => post.title).sort() : user.posts,
        );
        return user.posts.length > 0;
      },
      fields: (t) => ({
        firstName: t.exposeString('firstName'),
        lastName: t.exposeString('lastName'),
        published: t.relation('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => ctx.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await runCaptured(
      builder.toSchema(),
      '{ users { firstName lastName published { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [{ firstName: 'Alice', lastName: 'Andrews', published: [{ title: 'Hello, Pothos' }] }],
    });
    expect(seen).toEqual([['Draft #1', 'Hello, Pothos']]);
    expect(result.statements).toHaveLength(1);
  });
});

describe.each(orders)('field-level authScopes (%s)', (_, plugins) => {
  function fieldAuthSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    builder.prismaObject('User', {
      select: ['email'],
      fields: (t) => ({
        publishedCount: t.int({
          select: { posts: { where: { published: 1 } } },
          authScopes: (user) => {
            seen.push([
              user.email,
              // @ts-expect-error a field's select is loaded for its resolve only
              Array.isArray(user.posts) ? user.posts.length : user.posts,
            ]);
            return true;
          },
          resolve: (user) => user.posts.length,
        }),
        all: t.relation('posts'),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  // In either order, the checks never see the field's filtered load. The whole relation, which
  // another field loads, is the row's plain `posts`.
  it.each([
    ['{ users { publishedCount } }', undefined],
    ['{ users { publishedCount all { id } } }', 2],
  ])("see the type's select, not the field's: %s", async (query, posts) => {
    const seen: unknown[] = [];
    const result = await runCaptured(fieldAuthSchema(seen), query);
    expect(result.errors).toBeUndefined();
    expect(
      result.data.users.map((user: { publishedCount: number }) => user.publishedCount),
    ).toEqual([1, 1]);
    expect(seen).toEqual([
      ['alice@example.com', posts],
      ['bob@example.com', posts],
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

// Scope-auth listed before this plugin gets, from `pothosScopeAuthParent`, a parent holding what the
// type's select and its interfaces' selects load. A row without it is reloaded before the checks
// run, in one batch per field, and a row with it costs no statement.
describe("a type's select before plugins listed first", () => {
  function typeDataSchema(seen: unknown[], defer = false) {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, PrismaNextPlugin],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    const User = builder.prismaObject('User', {
      select: { email: true, posts: true },
      authScopes: (user) => {
        seen.push(['type', user.email, user.posts?.length]);
        return true;
      },
      fields: (t) => ({
        firstName: t.exposeString('firstName', {
          authScopes: (user) => {
            seen.push(['field', user.email, user.posts?.length]);
            return true;
          },
        }),
        label: t.string({
          select: ['lastName'],
          authScopes: (user) => {
            seen.push(['label', user.email]);
            return true;
          },
          resolve: (user) => `${user.email} ${user.lastName}`,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        handBuilt: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) as never }),
        handBuiltList: t.field({
          type: [User],
          resolve: () => [{ id: 'u-alice' }, { id: 'u-bob' }] as never,
        }),
        user: t.prismaField({
          type: 'User',
          collection: () => ctx.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    return defer
      ? builder.toSchema({ directives: [...specifiedDirectives, GraphQLDeferDirective] })
      : builder.toSchema();
  }

  const alice = (kind: string) => [kind, 'alice@example.com', 2];

  it('costs no statement for a row the query loaded', async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(typeDataSchema(seen), '{ user { firstName label } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: { firstName: 'Alice', label: 'alice@example.com Andrews' },
    });
    expect(new Set(seen.map((entry) => JSON.stringify(entry)))).toEqual(
      new Set(
        [alice('type'), alice('field'), ['label', 'alice@example.com']].map((entry) =>
          JSON.stringify(entry),
        ),
      ),
    );
    expect(result.statements).toHaveLength(1);
  });

  it('reloads a hand-built row, in one statement for every parent', async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(typeDataSchema(seen), '{ handBuiltList { firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ handBuiltList: [{ firstName: 'Alice' }, { firstName: 'Bob' }] });
    expect(seen).not.toContainEqual(expect.arrayContaining([undefined]));
    expect(seen).toContainEqual(alice('type'));
    expect(seen).toContainEqual(alice('field'));
    expect(seen).toContainEqual(['field', 'bob@example.com', 2]);
    expect(result.statements).toHaveLength(1);
  });

  it('reloads a hand-built row once for a field that loads its own select', async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(typeDataSchema(seen), '{ handBuilt { label } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ handBuilt: { label: 'alice@example.com Andrews' } });
    expect(seen).toEqual([alice('type'), ['label', 'alice@example.com']]);
    expect(result.statements).toHaveLength(1);
  });

  it('shows deferred fields what the type selects', async () => {
    const seen: unknown[] = [];
    const statements: CapturedExecution[] = [];
    await withCapture(statements, async () => {
      const result = await experimentalExecuteIncrementally({
        schema: typeDataSchema(seen, true),
        document: parse('{ handBuilt { firstName ... @defer { label } } }'),
        contextValue: {},
      });
      if (!('initialResult' in result)) {
        throw new Error('Expected an incremental result');
      }
      for await (const _patch of result.subsequentResults) {
        // drain
      }
    });
    expect(seen).not.toContainEqual(expect.arrayContaining([undefined]));
    expect(seen).toContainEqual(alice('field'));
    expect(seen).toContainEqual(['label', 'alice@example.com']);
    // The deferred field shares the hand-built row's reload with the first batch.
    expect(statements).toHaveLength(1);
  });

  it('fails the field whose reload cannot find its collection', async () => {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, PrismaNextPlugin],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { context: ctx.client.context, client: () => ({ orm: {} }) as never },
    });
    const User = builder.prismaObject('User', {
      select: ['email'],
      authScopes: () => true,
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        handBuilt: t.field({
          type: User,
          nullable: true,
          resolve: () => ({ id: 'u-alice' }) as never,
        }),
      }),
    });
    const result = await runCaptured(builder.toSchema(), '{ handBuilt { firstName } }');
    expect(result.errors?.map((error) => [error.path, detailOf(error)])).toEqual([
      [['handBuilt', 'firstName'], "prisma.client has no collection for 'User'."],
    ]);
    expect(result.errors?.[0]?.originalError?.cause).toBeInstanceOf(Error);
  });
  it('reloads the column t.expose* exposes before its authScopes', async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, PrismaNextPlugin],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        firstName: t.exposeString('firstName', {
          authScopes: (user) => {
            seen.push(user.firstName);
            return true;
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        // @ts-expect-error a row built by hand isn't planned; it reloads
        handBuilt: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) }),
      }),
    });
    const result = await runCaptured(builder.toSchema(), '{ handBuilt { firstName } }');
    expect(result.data).toEqual({ handBuilt: { firstName: 'Alice' } });
    expect(seen).toEqual(['Alice']);
    expect(result.statements).toHaveLength(1);
  });

  it('passes through a database error from a reload', async () => {
    // A table without the `email` column the contract declares.
    const db = createSqliteRuntime(
      ctx.contract,
      sampleDdl
        .replace('email TEXT NOT NULL UNIQUE', 'nickname TEXT')
        .replace(
          /INSERT INTO user \(id, firstName, lastName, email\)/,
          'INSERT INTO user (id, firstName, lastName, nickname)',
        ),
    );
    try {
      const builder = new SchemaBuilder<{
        PrismaContract: SampleContract;
        AuthScopes: { ok: boolean };
      }>({
        plugins: [ScopeAuthPlugin, PrismaNextPlugin],
        scopeAuth: { authScopes: () => ({ ok: true }) },
        prisma: { client: db.client },
      });
      const User = builder.prismaObject('User', {
        select: ['email'],
        authScopes: () => true,
        fields: (t) => ({ firstName: t.exposeString('firstName') }),
      });
      builder.queryType({
        fields: (t) => ({
          handBuilt: t.field({
            type: User,
            nullable: true,
            resolve: () => ({ id: 'u-alice' }) as never,
          }),
        }),
      });
      const result = await runCaptured(builder.toSchema(), '{ handBuilt { firstName } }');
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]!.originalError).toBeInstanceOf(SqlQueryError);
      expect(result.errors![0]!.message).toMatch(/email/);
    } finally {
      await db.cleanup();
    }
  });

  it('shares the database error when a field reads a failed auth reload', async () => {
    const db = createSqliteRuntime(
      ctx.contract,
      sampleDdl
        .replace('email TEXT NOT NULL UNIQUE', 'nickname TEXT')
        .replace(
          /INSERT INTO user \(id, firstName, lastName, email\)/,
          'INSERT INTO user (id, firstName, lastName, nickname)',
        ),
    );
    try {
      const builder = new SchemaBuilder<{
        PrismaContract: SampleContract;
        AuthScopes: { ok: boolean };
      }>({
        plugins: [ScopeAuthPlugin, PrismaNextPlugin],
        scopeAuth: { authScopes: () => ({ ok: true }) },
        prisma: { client: db.client },
      });
      const User = builder.prismaObject('User', {
        select: ['firstName'],
        fields: (t) => ({
          guarded: t.string({
            authScopes: (user) => ({ ok: typeof user.firstName === 'string' }),
            resolve: () => 'guarded',
          }),
          firstName: t.exposeString('firstName'),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          handBuilt: t.field({
            type: User,
            nullable: true,
            resolve: () => ({ id: 'u-alice' }) as never,
          }),
        }),
      });
      const result = await runCaptured(builder.toSchema(), '{ handBuilt { guarded firstName } }');
      expect(result.errors).toHaveLength(2);
      const failure = result.errors![0]!.originalError;
      expect(failure).toBeInstanceOf(SqlQueryError);
      expect(result.errors![1]!.originalError).toBe(failure);
      expect(result.statements).toHaveLength(1);
    } finally {
      await db.cleanup();
    }
  });

  it("passes the app's own errors from a reload through as they are", async () => {
    class TenantError extends Error {}
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, PrismaNextPlugin],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: {
        context: ctx.client.context,
        client: () => {
          throw new TenantError('no tenant');
        },
      },
    });
    const User = builder.prismaObject('User', {
      select: ['email'],
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        handBuilt: t.field({
          type: User,
          nullable: true,
          resolve: () => ({ id: 'u-alice' }) as never,
        }),
      }),
    });
    const result = await runCaptured(builder.toSchema(), '{ handBuilt { firstName } }');
    expect(result.errors?.map((error) => error.message)).toEqual(['no tenant']);
    expect(result.errors?.[0]?.originalError).toBeInstanceOf(TenantError);
  });
});

// Another plugin's resolver wrapper hands the users field a rebuilt row without `email`.
describe('rows another plugin rebuilt without what the type selects', () => {
  class StripEmailPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(
      resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
      fieldConfig: PothosOutputFieldConfig<Types>,
    ): GraphQLFieldResolver<unknown, Types['Context'], object> {
      if (fieldConfig.parentType !== 'Query') {
        return resolver;
      }
      return async (parent, args, context, info) => {
        const rows = (await resolver(parent, args, context, info)) as Record<string, unknown>[];
        return rows.map(({ email: _email, ...rest }) => rest);
      };
    }
  }
  SchemaBuilder.registerPlugin('prismaNextTestStripEmail' as never, StripEmailPlugin as never);

  it('reloads them before type-level authScopes run', async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, 'prismaNextTestStripEmail' as never, PrismaNextPlugin],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    builder.prismaObject('User', {
      select: ['email'],
      authScopes: (user) => {
        seen.push(user.email);
        return true;
      },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await runCaptured(builder.toSchema(), '{ users { firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ firstName: 'Alice' }, { firstName: 'Bob' }] });
    expect(seen).toEqual(['alice@example.com', 'bob@example.com']);
    // The users, and one reload of both rows.
    expect(result.statements).toHaveLength(2);
  });

  class ForgePostsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(
      resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
      fieldConfig: PothosOutputFieldConfig<Types>,
    ): GraphQLFieldResolver<unknown, Types['Context'], object> {
      if (fieldConfig.parentType !== 'Query') {
        return resolver;
      }
      return async (parent, args, context, info) => {
        const rows = (await resolver(parent, args, context, info)) as Record<string, unknown>[];
        return rows.map(({ email: _email, ...rest }) => ({
          ...rest,
          posts: [{ id: 'p-forged', title: 'Forged' }],
        }));
      };
    }
  }
  SchemaBuilder.registerPlugin('prismaNextTestForgePosts' as never, ForgePostsPlugin as never);

  // The field reads the relation the plugin wrote: only a key the field's own selection reads that
  // is undefined reloads the row.
  it('keeps a relation the rebuilt row holds', async () => {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, 'prismaNextTestForgePosts' as never, PrismaNextPlugin],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    builder.prismaObject('User', {
      select: ['email'],
      authScopes: () => true,
      fields: (t) => ({ posts: t.relation('posts') }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => ctx.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await runCaptured(builder.toSchema(), '{ users { posts { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ posts: [{ title: 'Forged' }] }] });
  });
});

describe('rows a root connection pages', () => {
  function helperSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    const User = builder.prismaObject('User', {
      select: { posts: { where: { published: 1 } } },
      authScopes: (user) => {
        seen.push(user.posts);
        return true;
      },
      fields: (t) => ({
        id: t.exposeID('id'),
        drafts: t.relation('posts', { query: { where: { published: 0 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({ type: User, collection: () => ctx.orm.User }),
      }),
    });
    return builder.toSchema();
  }

  it("hand type-level authScopes the type select's rows", async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(
      helperSchema(seen),
      '{ users(first: 2) { edges { node { id drafts { id } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users.edges).toEqual([
      { node: { id: 'u-alice', drafts: [{ id: 'p-draft1' }] } },
      { node: { id: 'u-bob', drafts: [{ id: 'p-bob-draft' }] } },
    ]);
    expect(seen).toEqual([
      [expect.objectContaining({ id: 'p-hello' })],
      [expect.objectContaining({ id: 'p-bob1' })],
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

// `User.championed` targets Feature, a variant with a table of its own, whose rows load through
// `orm.Feature`. It reads only the feature table, so a helper's page of them lacks the columns
// Feature inherits from Task, such as `title`.
describe("a connection helper's page of a variant with a table of its own", () => {
  it("reloads the inherited columns the type's select loads before its authScopes", async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaContract: InheritanceContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: inheritanceDb.client },
    });
    const Feature = builder.prismaObject('Feature', {
      select: ['title'],
      authScopes: (feature) => {
        seen.push([feature.id, feature.title]);
        return true;
      },
      fields: (t) => ({ priority: t.exposeInt('priority') }),
    });
    const helper = prismaConnectionHelpers(builder, Feature, {});
    builder.prismaObject('User', {
      fields: (t) => ({
        championPage: t.connection({
          type: Feature,
          select: (args, ctx, nestedSelection) => ({
            championed: helper.getQuery(args, ctx, nestedSelection),
          }),
          resolve: (user, args, context) => helper.resolve(user.championed, args, context),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], collection: () => inheritanceDb.orm.User }),
      }),
    });
    const result = await runCaptured(
      builder.toSchema(),
      '{ users { championPage(first: 5) { edges { node { priority } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([{ championPage: { edges: [{ node: { priority: 5 } }] } }]);
    expect(seen).toEqual([['t2', 'feat1']]);
    // The users with their features, and one reload of Task's columns.
    expect(result.statements).toHaveLength(2);
  });

  // A field Feature inherits from an interface without a model reads the row as Feature's select
  // loads it too, so its authScopes can't pass on a row missing `title`.
  it.each([
    ['field', false],
    ['runScopesOnType', true],
  ])('reloads them for a field of an interface without a model (%s)', async (_, onType) => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaContract: InheritanceContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: onType },
      prisma: { client: inheritanceDb.client },
    });
    const Labeled = builder.interfaceRef<{ id: string }>('Labeled').implement({
      fields: (t) => ({ label: t.string({ resolve: (row) => `label ${row.id}` }) }),
    });
    const Feature = builder.prismaObject('Feature', {
      interfaces: [Labeled],
      select: ['title'],
      authScopes: (feature) => {
        seen.push([feature.id, feature.title]);
        return feature.title !== 'feat1';
      },
      fields: (t) => ({ priority: t.exposeInt('priority') }),
    });
    const helper = prismaConnectionHelpers(builder, Feature, {});
    builder.prismaObject('User', {
      fields: (t) => ({
        championPage: t.connection({
          type: Feature,
          select: (args, ctx, nestedSelection) => ({
            championed: helper.getQuery(args, ctx, nestedSelection),
          }),
          resolve: (user, args, context) => helper.resolve(user.championed, args, context),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], collection: () => inheritanceDb.orm.User }),
      }),
    });
    const result = await runCaptured(
      builder.toSchema(),
      '{ users { championPage(first: 5) { edges { node { label } } } } }',
    );
    expect(seen).toEqual([['t2', 'feat1']]);
    expect(result.errors?.map((error) => error.message)).toEqual([
      expect.stringContaining('Not authorized'),
    ]);
  });
});

// With `runScopesOnType`, type-level authScopes run from `isTypeOf`, before any field of the type
// can reload its row. Scope-auth gets the row they see from `pothosScopeAuthParent`.
describe('runScopesOnType on rows without what the type selects', () => {
  it("supplies a loader of scope-auth's type", () => {
    // The method is private, which an indexed access type still reads.
    type Loader = ReturnType<PothosPrismaNextPlugin<SchemaTypes>['typeRow']>;
    expectTypeOf<Loader>().not.toBeAny();
    expectTypeOf<Loader>().toExtend<ScopeAuthParentLoader>();
  });

  // Records whether each parent the prisma plugin's `pothosScopeAuthParent` returns is a promise.
  // Type configs pass through plugins last to first, so this one is listed before it.
  const parentResults: string[] = [];
  class RecordScopeAuthParentPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
      const load = typeConfig.extensions?.pothosScopeAuthParent as
        | ScopeAuthParentLoader
        | undefined;
      if (!load) {
        return typeConfig;
      }
      const record: ScopeAuthParentLoader = (parent, context, info) => {
        const result = load(parent, context, info);
        parentResults.push(isThenable(result) ? 'promise' : 'value');
        return result;
      };
      return {
        ...typeConfig,
        extensions: { ...typeConfig.extensions, pothosScopeAuthParent: record },
      };
    }
  }
  SchemaBuilder.registerPlugin(
    'prismaNextTestRecordScopeAuthParent' as never,
    RecordScopeAuthParentPlugin as never,
  );

  function userSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [
        ScopeAuthPlugin,
        'prismaNextTestRecordScopeAuthParent' as never,
        RelayPlugin,
        PrismaNextPlugin,
      ],
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: true },
      prisma: { client: ctx.client },
    });
    const User = builder.prismaObject('User', {
      select: { email: true, posts: true },
      authScopes: (user) => {
        seen.push([user.email, user.posts?.length]);
        return true;
      },
      fields: (t) => ({
        firstName: t.exposeString('firstName'),
        // Reads only what the type selects, so it shares the reload of the type's authScopes.
        greeting: t.string({ resolve: (user) => `Hi ${user.email}` }),
      }),
    });
    const Post = builder.prismaNode('Post', {
      id: { field: 'id' },
      select: ['title'],
      authScopes: (post) => {
        seen.push([post.id, post.title]);
        return true;
      },
      fields: (t) => ({ heading: t.string({ resolve: (post) => post.title }) }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          collection: () => ctx.orm.User.where({ id: 'u-alice' }),
        }),
        copied: t.field({
          type: User,
          resolve: async () => {
            const row = await ctx.orm.User.where({ id: 'u-alice' }).first();
            const { email: _email, ...copy } = row!;
            return copy as never;
          },
        }),
        copiedPost: t.field({
          type: Post,
          resolve: async () => {
            const row = await ctx.orm.Post.where({ id: 'p-hello' }).first();
            const { title: _title, ...copy } = row!;
            return copy as never;
          },
        }),
      }),
    });
    return builder.toSchema();
  }

  it('hands type-level authScopes a loaded row as it is, without a promise', async () => {
    const seen: unknown[] = [];
    parentResults.length = 0;
    const result = await runCaptured(userSchema(seen), '{ user { firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { firstName: 'Alice' } });
    expect(seen).toEqual([['alice@example.com', 2]]);
    expect(parentResults).toEqual(['value']);
    expect(result.statements).toHaveLength(1);
  });

  it('reloads a copied row before type-level authScopes run', async () => {
    const seen: unknown[] = [];
    parentResults.length = 0;
    const result = await runCaptured(userSchema(seen), '{ copied { firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ copied: { firstName: 'Alice' } });
    expect(seen).toEqual([['alice@example.com', 2]]);
    expect(parentResults).toEqual(['promise']);
    // The user, and one reload of the copy, which the type's authScopes and the field share.
    expect(result.statements).toHaveLength(2);
  });

  it("shares the type's reload with a field that reads only what the type selects", async () => {
    const seen: unknown[] = [];
    parentResults.length = 0;
    const result = await runCaptured(userSchema(seen), '{ copied { greeting } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ copied: { greeting: 'Hi alice@example.com' } });
    expect(seen).toEqual([['alice@example.com', 2]]);
    expect(parentResults).toEqual(['promise']);
    // The user, and one reload for both the type's authScopes and the field.
    expect(result.statements).toHaveLength(2);
  });

  it('reloads a copied Relay node row before type-level authScopes run', async () => {
    const seen: unknown[] = [];
    parentResults.length = 0;
    const result = await runCaptured(userSchema(seen), '{ copiedPost { heading } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ copiedPost: { heading: 'Hello, Pothos' } });
    expect(seen).toEqual([['p-hello', 'Hello, Pothos']]);
    expect(parentResults).toEqual(['promise']);
    expect(result.statements).toHaveLength(2);
  });

  // `User.championed` targets Feature, which has a table of its own, so a helper's page of them
  // lacks the columns Feature inherits from Task, such as `title`.
  it("reloads a variant's inherited columns from a connection helper's page", async () => {
    const seen: unknown[] = [];
    parentResults.length = 0;
    const builder = new SchemaBuilder<{
      PrismaContract: InheritanceContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [
        ScopeAuthPlugin,
        'prismaNextTestRecordScopeAuthParent' as never,
        RelayPlugin,
        PrismaNextPlugin,
      ],
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: true },
      prisma: { client: inheritanceDb.client },
    });
    const Feature = builder.prismaObject('Feature', {
      select: ['title'],
      authScopes: (feature) => {
        seen.push([feature.id, feature.title]);
        return true;
      },
      fields: (t) => ({ priority: t.exposeInt('priority') }),
    });
    const helper = prismaConnectionHelpers(builder, Feature, {});
    builder.prismaObject('User', {
      fields: (t) => ({
        championPage: t.connection({
          type: Feature,
          select: (args, ctx, nestedSelection) => ({
            championed: helper.getQuery(args, ctx, nestedSelection),
          }),
          resolve: (user, args, context) => helper.resolve(user.championed, args, context),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], collection: () => inheritanceDb.orm.User }),
      }),
    });
    const result = await runCaptured(
      builder.toSchema(),
      '{ users { championPage(first: 5) { edges { node { priority } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([{ championPage: { edges: [{ node: { priority: 5 } }] } }]);
    expect(seen).toEqual([['t2', 'feat1']]);
    expect(parentResults).toEqual(['promise']);
    // The users with their features, and one reload of the page's row, which the type's
    // authScopes and the field share.
    expect(result.statements).toHaveLength(2);
  });
});

// With `runScopesOnType`, type-level authScopes run from `isTypeOf`, on the row the parent field
// resolved. Two implementations of an interface, reached from a root list and from a relation.
type AdminPostSelect = true | { readonly where: { readonly published: 1 } } | undefined;

describe.each(orders)('runScopesOnType through an interface (%s)', (_order, plugins) => {
  function runScopesSchema(seen: unknown[], adminPosts: AdminPostSelect) {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: true },
      prisma: { client: ctx.client },
    });
    const Person = builder.prismaInterface('User', {
      select: ['email'],
      resolveType: (user) => (user.email === 'alice@example.com' ? 'Admin' : 'Member'),
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    const record = (
      typename: string,
      user: { email: string; posts?: readonly { id: string }[] },
    ) => {
      seen.push([typename, user.email, user.posts?.map((post) => post.id).sort()]);
      return true;
    };
    builder.prismaObject('User', {
      variant: 'Member',
      interfaces: [Person],
      select: { email: true, posts: true },
      authScopes: (user) => record('Member', user),
    });
    builder.prismaObject('User', {
      variant: 'Admin',
      interfaces: [Person],
      select: adminPosts === undefined ? { email: true } : { email: true, posts: adminPosts },
      authScopes: (user) => record('Admin', user),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ id: t.exposeID('id'), author: t.relation('author') }),
    });
    builder.queryType({
      fields: (t) => ({
        people: t.prismaField({
          type: [Person],
          collection: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
        posts: t.prismaField({
          type: ['Post'],
          collection: () => ctx.orm.Post.where({ id: 'p-bob1' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  async function run(adminPosts: AdminPostSelect) {
    const seen: unknown[] = [];
    const schema = runScopesSchema(seen, adminPosts);
    const root = await runCaptured(schema, '{ people { __typename firstName } }');
    expect(root.errors).toBeUndefined();
    expect(root.data).toEqual({
      people: [
        { __typename: 'Admin', firstName: 'Alice' },
        { __typename: 'Member', firstName: 'Bob' },
      ],
    });
    const rootSeen = seen.splice(0);
    const relation = await runCaptured(schema, '{ posts { author { __typename firstName } } }');
    expect(relation.errors).toBeUndefined();
    expect(relation.data).toEqual({
      posts: [{ author: { __typename: 'Member', firstName: 'Bob' } }],
    });
    return { rootSeen, relationSeen: seen };
  }

  const memberSeen = ['Member', 'bob@example.com', ['p-bob-draft', 'p-bob1']];

  it.each([
    ['the same relation', true, ['p-draft1', 'p-hello']],
    // The row is shared, so Admin also sees the posts Member's select loads.
    ['no relation', undefined, ['p-draft1', 'p-hello']],
  ] as const)('loads the relation an implementation selects when the other selects %s', async (_name, adminPosts, adminPostIds) => {
    const { rootSeen, relationSeen } = await run(adminPosts);
    expect(rootSeen).toEqual([['Admin', 'alice@example.com', adminPostIds], memberSeen]);
    expect(relationSeen).toEqual([memberSeen]);
  });

  it('rejects implementations that select the relation with different arguments', () => {
    expect(() => runScopesSchema([], { where: { published: 1 } })).toThrow(
      "'Member' and 'Admin' both select 'posts', with different definitions.",
    );
  });
});

describe('rows another field filtered', () => {
  const orders = [
    ['before', [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin]],
    ['after', [RelayPlugin, PrismaNextPlugin, ScopeAuthPlugin]],
  ] as const;

  function auditBuilder(plugins: readonly unknown[]) {
    return new SchemaBuilder<{ PrismaContract: SampleContract }>({
      plugins: plugins as never,
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
  }

  // The second field of `drafts` loads the same query as the first, so both share one slot.
  const queries = [
    ['one filtering consumer', '{ users { drafts { id } audited { id } } }'],
    ['two filtering consumers', '{ users { drafts { id } again: drafts { id } audited { id } } }'],
  ];

  describe.each(orders)('scope auth %s the prisma plugin', (_name, plugins) => {
    // A returned row needn't hold the to-many relations of its type's select, so the check sees
    // the row reloaded with them, never the rows another field filtered.
    it.each(queries)('hides them from a type-level select, with %s', async (_label, source) => {
      const seen: unknown[] = [];
      const builder = auditBuilder(plugins);
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      const Audited = builder.prismaObject('User', {
        variant: 'Audited',
        select: { posts: true },
        authScopes: (user) => {
          // Typed without `posts`, which isn't loaded for it, so the rows `drafts` filtered don't
          // show either.
          const { posts } = user as unknown as { posts?: { id: string }[] };
          seen.push(posts?.map((post) => post.id).sort());
          return true;
        },
        fields: (t) => ({
          id: t.exposeID('id'),
          postCount: t.int({ resolve: (user) => user.posts.length }),
        }),
      });
      builder.prismaObject('User', {
        fields: (t) => ({
          drafts: t.relation('posts', { query: { where: { published: 0 } } }),
          audited: t.field({ type: Audited, resolve: (user) => user }),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          users: t.prismaField({
            type: ['User'],
            collection: () => ctx.orm.User.where({ id: 'u-alice' }),
          }),
        }),
      });
      const result = await runCaptured(builder.toSchema(), source);
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toMatchObject([
        { drafts: [{ id: 'p-draft1' }], audited: { id: 'u-alice' } },
      ]);
      expect(seen).toEqual([['p-draft1', 'p-hello']]);
    });

    it('hides them from a resolveType', async () => {
      const seen: unknown[] = [];
      const builder = auditBuilder(plugins);
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      const Audited = builder.prismaInterface('User', {
        variant: 'AuditedNode',
        select: { posts: true },
        resolveType: (user) => {
          // Typed without `posts`, which isn't loaded for it, so the rows `drafts` filtered don't
          // show either.
          const { posts } = user as unknown as { posts?: { id: string }[] };
          seen.push(posts?.map((post) => post.id).sort());
          return 'AuditedUser';
        },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.prismaObject('User', {
        variant: 'AuditedUser',
        interfaces: [Audited],
        fields: () => ({}),
      });
      builder.prismaObject('User', {
        fields: (t) => ({
          drafts: t.relation('posts', { query: { where: { published: 0 } } }),
          audited: t.field({ type: Audited, resolve: (user) => user }),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          users: t.prismaField({
            type: ['User'],
            collection: () => ctx.orm.User.where({ id: 'u-alice' }),
          }),
        }),
      });
      const result = await runCaptured(
        builder.toSchema(),
        '{ users { drafts { id } audited { id } } }',
      );
      expect(result.errors).toBeUndefined();
      expect(seen).toEqual([undefined]);
    });
  });
});

// An interface and its implementation that select a relation alike share one version of it.
// Selecting it differently is a build error, which tests/interfaces.test.ts covers.
describe('a relation an interface and its implementation select alike', () => {
  describe.each([
    ['before', [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin]],
    ['after', [RelayPlugin, PrismaNextPlugin, ScopeAuthPlugin]],
  ] as const)('scope auth %s the prisma plugin', (_name, plugins) => {
    it('is what the type checks and fields of both see', async () => {
      const seen: string[] = [];
      const builder = new SchemaBuilder<{ PrismaContract: SampleContract }>({
        plugins: plugins as never,
        relay: {},
        scopeAuth: { authScopes: () => ({ ok: true }) },
        prisma: { client: ctx.client },
      });
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      const Published = builder.prismaInterface('User', {
        variant: 'Published',
        select: { posts: { where: { published: 1 } } },
        authScopes: (user) => {
          seen.push(`Published: ${user.posts.map((post) => post.id)}`);
          return true;
        },
        fields: (t) => ({
          id: t.exposeID('id'),
          interfaceIds: t.idList({ resolve: (user) => user.posts.map((post) => post.id) }),
        }),
      });
      const Author = builder.prismaObject('User', {
        variant: 'Author',
        interfaces: [Published],
        select: { posts: { where: { published: 1 } } },
        authScopes: (user) => {
          seen.push(`Author: ${user.posts.map((post) => post.id)}`);
          return true;
        },
        fields: (t) => ({
          ownIds: t.idList({ resolve: (user) => user.posts.map((post) => post.id) }),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          author: t.prismaField({
            type: Author,
            collection: () => ctx.orm.User.where({ id: 'u-alice' }),
          }),
        }),
      });
      const result = await runCaptured(builder.toSchema(), '{ author { id interfaceIds ownIds } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.author).toEqual({
        id: 'u-alice',
        interfaceIds: ['p-hello'],
        ownIds: ['p-hello'],
      });
      expect(new Set(seen)).toEqual(new Set(['Published: p-hello', 'Author: p-hello']));
      expect(result.statements).toHaveLength(1);
    });
  });
});

// A row holds one version of a relation, so an interface and its implementation whose selects
// load it differently would each pass their auth check on the other's.
describe('a relation an interface and its implementation both select', () => {
  describe.each([
    ['before', [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin]],
    ['after', [RelayPlugin, PrismaNextPlugin, ScopeAuthPlugin]],
  ] as const)('scope auth %s the prisma plugin', (_name, plugins) => {
    it('fails the schema build', () => {
      const builder = new SchemaBuilder<{
        PrismaContract: SampleContract;
        AuthScopes: { ok: boolean };
      }>({
        plugins: plugins as never,
        relay: {},
        scopeAuth: { authScopes: () => ({ ok: true }) },
        prisma: { client: ctx.client },
      });
      const Limited = builder.prismaInterface('User', {
        variant: 'Limited',
        select: { posts: true },
        authScopes: (user) => user.posts.length <= 1,
        resolveType: () => 'User',
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.prismaObject('User', {
        interfaces: [Limited],
        select: { posts: { where: { published: 1 } } },
        fields: (t) => ({ email: t.exposeString('email') }),
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Limited' and 'User' both select 'posts', with different definitions.",
      );
    });
  });
});

// To-many slots beneath a shared walk answer with the rows their own arguments loaded, whichever
// invocation's name they were written under. The expected values come from the plugin before walks
// were shared, at 7d1bece5c.
describe('slots beneath shared walks', () => {
  const seen: unknown[] = [];
  let schema: GraphQLSchema;

  beforeAll(() => {
    const b: any = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, RelayPlugin, PrismaNextPlugin],
      relay: { nodesOnConnection: true },
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    const L = b
      .interfaceRef('L')
      .implement({ fields: (t: any) => ({ l: t.string({ resolve: () => 'l' }) }) });
    const UI = b.prismaInterface('User', {
      variant: 'UI',
      select: ['firstName'],
      resolveType: (u: any) => {
        seen.push(['resolveType', u.firstName]);
        return u.firstName === 'Alice' ? 'U1' : 'U2';
      },
      fields: (t: any) => ({ uid: t.exposeID('id') }),
    });
    const PI = b.prismaInterface('Post', {
      variant: 'PI',
      select: ['published'],
      resolveType: (p: any) => {
        seen.push(['resolveType', 'PI', p.published]);
        return p.published === 1 ? 'P1' : 'P2';
      },
      fields: (t: any) => ({ pid: t.exposeID('id') }),
    });
    const pub = (t: any) => t.relation('posts', { type: PI, query: { where: { published: 1 } } });
    const dra = (t: any) => t.relation('posts', { type: PI, query: { where: { published: 0 } } });
    b.prismaInterfaceFields(UI, (t: any) => ({
      published: pub(t),
      drafts: dra(t),
      own: t.relation('posts', { type: PI }),
      page: t.relatedConnection('posts', {
        type: PI,
        query: { where: { published: 1 } },
        totalCount: true,
      }),
      nPub: t.relationCount('posts', { query: { where: { published: 1 } } }),
    }));
    b.prismaInterfaceFields(PI, (t: any) => ({
      author: t.relation('author', { type: UI }),
      comments: t.relation('comments', {}),
      firstComment: t.relation('comments', { query: { limit: 1 } }),
    }));
    b.prismaObject('Comment', {
      fields: (t: any) => ({ id: t.exposeID('id'), author: t.relation('author', { type: UI }) }),
    });
    b.prismaObject('User', {
      variant: 'U1',
      interfaces: [UI, L],
      select: { firstName: true, posts: true },
      fields: (t: any) => ({
        own: pub(t),
        postCount: t.int({ resolve: (u: any) => u.posts.length }),
      }),
    });
    b.prismaObject('User', {
      variant: 'U2',
      interfaces: [UI, L],
      select: { firstName: true, posts: true },
      fields: (t: any) => ({ own: dra(t), total: t.int({ resolve: (u: any) => u.posts.length }) }),
    });
    const Guarded = b.prismaObject('Post', {
      variant: 'GuardedPost',
      select: ['title'],
      authScopes: (p: any) => {
        seen.push(['auth', p.title]);
        return p.title !== 'Draft #1';
      },
      fields: (t: any) => ({
        title: t.exposeString('title'),
        author: t.relation('author', { type: UI }),
      }),
    });
    for (const n of ['P1', 'P2']) {
      b.prismaObject('Post', {
        variant: n,
        interfaces: [PI, L],
        select: { published: true, comments: true },
        fields: (t: any) => ({
          commentCount: t.int({ resolve: (p: any) => p.comments.length }),
          guarded: t.variant(Guarded, { nullable: true }),
        }),
      });
    }
    b.queryType({
      fields: (t: any) => ({
        users: t.prismaField({
          type: [UI],
          collection: () => ctx.orm.User.orderBy((u: any) => u.id.asc()),
        }),
      }),
    });

    schema = b.toSchema();
  });

  const nest = (type: string, s: string) => `... on L { ... on ${type} { ${s} } }`;
  const docs: Record<string, string> = {
    conflicting_two_levels: `{ users { ${nest('UI', `uid published { pid ${nest('PI', `author { ${nest('UI', 'uid drafts { pid } published { pid }')} }`)} } drafts { pid ${nest('PI', `author { ${nest('UI', 'uid published { pid } own { pid }')} }`)} } `)} } }`,
    per_impl_where: `{ users { ${nest('UI', `own { pid ${nest('PI', `author { ${nest('UI', 'own { pid }')} }`)} }`)} } }`,
    aliases: `{ users { ${nest('UI', `a: published { x: pid ${nest('PI', `y: author { ${nest('UI', 'c: drafts { pid } d: published { pid }')} }`)} } b: drafts { z: pid ${nest('PI', `y: author { ${nest('UI', 'c: published { pid }')} }`)} }`)} } }`,
    connections: `{ users { ${nest('UI', `page(first: 1) { totalCount edges { node { pid ${nest('PI', `author { ${nest('UI', 'page(first: 2) { nodes { pid } totalCount } nPub')} }`)} } } }`)} other: drafts { pid } } }`,
    connection_conflict: `{ users { ${nest('UI', 'a: page(first: 1) { nodes { pid } } b: page(first: 2) { nodes { pid } } nPub')} } }`,
    type_level_handover: `{ users { ${nest('UI', `published { pid firstComment { id } ... on P1 { commentCount } ${nest('PI', 'author { ... on U1 { postCount } ... on U2 { total } drafts { pid } }')} }`)} ... on U1 { postCount } ... on U2 { total } } }`,
    views: `{ users { ${nest('UI', `own { pid ... on P1 { guarded { title author { ${nest('UI', 'uid drafts { pid }')} } } } ... on P2 { guarded { title } } ${nest('PI', `firstComment { id author { ${nest('UI', 'uid own { pid }')} } }`)} }`)} } }`,
    views_denied: `{ users { ${nest('UI', `drafts { pid ... on P2 { guarded { title } } ${nest('PI', `author { ${nest('UI', 'drafts { pid ... on P2 { guarded { title } } }')} }`)} }`)} } }`,
    reused_fragment: `fragment C on PI { author { ${nest('UI', 'published { pid } drafts { pid }')} } } { users { ${nest('UI', 'published { ...C } drafts { ...C } own { ...C }')} } }`,
  };

  const expected = {
    conflicting_two_levels: {
      data: {
        users: [
          {
            uid: 'u-alice',
            published: [
              {
                pid: 'p-hello',
                author: {
                  uid: 'u-alice',
                  drafts: [{ pid: 'p-draft1' }],
                  published: [{ pid: 'p-hello' }],
                },
              },
            ],
            drafts: [
              {
                pid: 'p-draft1',
                author: {
                  uid: 'u-alice',
                  published: [{ pid: 'p-hello' }],
                  own: [{ pid: 'p-hello' }],
                },
              },
            ],
          },
          {
            uid: 'u-bob',
            published: [
              {
                pid: 'p-bob1',
                author: {
                  uid: 'u-bob',
                  drafts: [{ pid: 'p-bob-draft' }],
                  published: [{ pid: 'p-bob1' }],
                },
              },
            ],
            drafts: [
              {
                pid: 'p-bob-draft',
                author: {
                  uid: 'u-bob',
                  published: [{ pid: 'p-bob1' }],
                  own: [{ pid: 'p-bob-draft' }],
                },
              },
            ],
          },
        ],
      },
      seen: [
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
        '["resolveType","PI",1]',
      ],
      errors: [],
    },
    per_impl_where: {
      data: {
        users: [
          { own: [{ pid: 'p-hello', author: { own: [{ pid: 'p-hello' }] } }] },
          { own: [{ pid: 'p-bob-draft', author: { own: [{ pid: 'p-bob-draft' }] } }] },
        ],
      },
      seen: [
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
        '["resolveType","PI",1]',
      ],
      errors: [],
    },
    aliases: {
      data: {
        users: [
          {
            a: [{ x: 'p-hello', y: { c: [{ pid: 'p-draft1' }], d: [{ pid: 'p-hello' }] } }],
            b: [{ z: 'p-draft1', y: { c: [{ pid: 'p-hello' }] } }],
          },
          {
            a: [{ x: 'p-bob1', y: { c: [{ pid: 'p-bob-draft' }], d: [{ pid: 'p-bob1' }] } }],
            b: [{ z: 'p-bob-draft', y: { c: [{ pid: 'p-bob1' }] } }],
          },
        ],
      },
      seen: [
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
        '["resolveType","PI",1]',
      ],
      errors: [],
    },
    connections: {
      data: {
        users: [
          {
            page: {
              totalCount: 1,
              edges: [
                {
                  node: {
                    pid: 'p-hello',
                    author: { page: { nodes: [{ pid: 'p-hello' }], totalCount: 1 }, nPub: 1 },
                  },
                },
              ],
            },
            other: [{ pid: 'p-draft1' }],
          },
          {
            page: {
              totalCount: 1,
              edges: [
                {
                  node: {
                    pid: 'p-bob1',
                    author: { page: { nodes: [{ pid: 'p-bob1' }], totalCount: 1 }, nPub: 1 },
                  },
                },
              ],
            },
            other: [{ pid: 'p-bob-draft' }],
          },
        ],
      },
      seen: [
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
        '["resolveType","PI",1]',
      ],
      errors: [],
    },
    connection_conflict: {
      data: {
        users: [
          { a: { nodes: [{ pid: 'p-hello' }] }, b: { nodes: [{ pid: 'p-hello' }] }, nPub: 1 },
          { a: { nodes: [{ pid: 'p-bob1' }] }, b: { nodes: [{ pid: 'p-bob1' }] }, nPub: 1 },
        ],
      },
      seen: ['["resolveType","Alice"]', '["resolveType","Bob"]', '["resolveType","PI",1]'],
      errors: [],
    },
    type_level_handover: {
      data: {
        users: [
          {
            published: [
              {
                pid: 'p-hello',
                firstComment: [{ id: 'c-1' }],
                commentCount: 2,
                author: { postCount: 2, drafts: [{ pid: 'p-draft1' }] },
              },
            ],
            postCount: 2,
          },
          {
            published: [
              {
                pid: 'p-bob1',
                firstComment: [],
                commentCount: 0,
                author: { total: 2, drafts: [{ pid: 'p-bob-draft' }] },
              },
            ],
            total: 2,
          },
        ],
      },
      seen: [
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
        '["resolveType","PI",1]',
      ],
      errors: [],
    },
    views: {
      data: {
        users: [
          {
            own: [
              {
                pid: 'p-hello',
                guarded: {
                  title: 'Hello, Pothos',
                  author: { uid: 'u-alice', drafts: [{ pid: 'p-draft1' }] },
                },
                firstComment: [
                  { id: 'c-1', author: { uid: 'u-bob', own: [{ pid: 'p-bob-draft' }] } },
                ],
              },
            ],
          },
          { own: [{ pid: 'p-bob-draft', guarded: { title: 'Bob draft' }, firstComment: [] }] },
        ],
      },
      seen: [
        '["auth","Bob draft"]',
        '["auth","Hello, Pothos"]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
        '["resolveType","PI",1]',
      ],
      errors: [],
    },
    views_denied: {
      data: {
        users: [
          {
            drafts: [
              {
                pid: 'p-draft1',
                guarded: { title: null },
                author: { drafts: [{ pid: 'p-draft1', guarded: { title: null } }] },
              },
            ],
          },
          {
            drafts: [
              {
                pid: 'p-bob-draft',
                guarded: { title: 'Bob draft' },
                author: { drafts: [{ pid: 'p-bob-draft', guarded: { title: 'Bob draft' } }] },
              },
            ],
          },
        ],
      },
      seen: [
        '["auth","Bob draft"]',
        '["auth","Draft #1"]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
      ],
      errors: [
        'Not authorized to read fields for GuardedPost',
        'Not authorized to read fields for GuardedPost',
      ],
    },
    reused_fragment: {
      data: {
        users: [
          {
            published: [
              { author: { published: [{ pid: 'p-hello' }], drafts: [{ pid: 'p-draft1' }] } },
            ],
            drafts: [
              { author: { published: [{ pid: 'p-hello' }], drafts: [{ pid: 'p-draft1' }] } },
            ],
            own: [{ author: { published: [{ pid: 'p-hello' }], drafts: [{ pid: 'p-draft1' }] } }],
          },
          {
            published: [
              { author: { published: [{ pid: 'p-bob1' }], drafts: [{ pid: 'p-bob-draft' }] } },
            ],
            drafts: [
              { author: { published: [{ pid: 'p-bob1' }], drafts: [{ pid: 'p-bob-draft' }] } },
            ],
            own: [{ author: { published: [{ pid: 'p-bob1' }], drafts: [{ pid: 'p-bob-draft' }] } }],
          },
        ],
      },
      seen: [
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
        '["resolveType","PI",0]',
        '["resolveType","PI",1]',
      ],
      errors: [],
    },
  };

  it.each(Object.keys(expected) as (keyof typeof expected)[])('%s', async (name) => {
    seen.length = 0;

    const statements: CapturedExecution[] = [];
    const result = await withCapture(statements, async () =>
      execute({ schema, document: parse(docs[name]), contextValue: {} }),
    );

    expect(result.errors?.map((error) => error.message) ?? []).toEqual(expected[name].errors);
    expect(result.data).toEqual(expected[name].data);
    expect([...new Set(seen.map((entry) => JSON.stringify(entry)))].sort()).toEqual(
      expected[name].seen,
    );
    expect(statements).toHaveLength(1);
  });
});

// A type check that can't see the row it checks fails with the plugin's generic error.
describe.each(orders)('a type check that cannot run (%s)', (_, plugins) => {
  function schema() {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: plugins as never,
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: true },
      prisma: { client: ctx.client },
    });
    const Limited = builder.prismaInterface('User', {
      variant: 'Limited',
      select: { posts: true },
      resolveType: () => 'User',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Limited],
      select: { email: true },
      authScopes: (user) => user.email !== 'bob@example.com',
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.field({
          type: User,
          nullable: true,
          args: { id: t.arg.id({ required: true }) },
          // A row without the email the type selects, which the check reloads.
          resolve: (_root, { id }) => ({ id: String(id) }) as never,
        }),
      }),
    });
    return builder.toSchema();
  }

  it('fails a type check whose row fails to reload with a generic error', async () => {
    const result = await runCaptured(schema(), '{ user(id: "u-nobody") { firstName } }');
    expect(result.data).toEqual({ user: null });
    expect(result.errors?.map(detailOf)).toEqual([
      expect.stringMatching(/could not find the 'User' row/),
    ]);
  });
});

// A row another variant's select loaded doesn't hold what this type's select loads.
describe.each(orders)("a row of another variant's select (%s)", (_, plugins) => {
  it.each([false, true])('reloads it for type checks (runScopesOnType: %s)', async (onType) => {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: onType },
      prisma: { client: ctx.client },
    });
    const Drafts = builder.prismaObject('User', {
      variant: 'Drafts',
      select: { comments: true },
      // Passes on a row without `comments`.
      authScopes: (user) => !(user.comments?.length > 0),
      fields: (t) => ({ drafts: t.int({ resolve: (user) => user.comments.length }) }),
    });
    const Published = builder.prismaObject('User', {
      variant: 'Published',
      select: { posts: { where: { published: 1 } } },
      fields: (t) => ({ asDrafts: t.field({ type: Drafts, resolve: (user) => user as never }) }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: Published,
          collection: () => ctx.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await runCaptured(builder.toSchema(), '{ user { asDrafts { drafts } } }');
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for Drafts',
    ]);
  });
});

// A row reloaded for one root field isn't reused under the next, which a mutation can change it in.
describe.each(orders)('a row two mutations return (%s)', (_, plugins) => {
  it("checks each mutation's result as it is after that mutation", async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    const User = builder.prismaObject('User', {
      select: ['email'],
      authScopes: (user) => {
        seen.push(user.email);
        return true;
      },
      fields: (t) => ({ email: t.exposeString('email') }),
    });
    const shared = { id: 'u-alice' };
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    builder.mutationType({
      fields: (t) => ({
        rename: t.field({
          type: User,
          args: { email: t.arg.string({ required: true }) },
          resolve: async (_root, { email }) => {
            await ctx.orm.User.where({ id: 'u-alice' }).update({ email });
            return shared as never;
          },
        }),
      }),
    });
    try {
      const result = await runCaptured(
        builder.toSchema(),
        'mutation { first: rename(email: "first@example.com") { email } second: rename(email: "second@example.com") { email } }',
      );
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        first: { email: 'first@example.com' },
        second: { email: 'second@example.com' },
      });
      expect(seen).toEqual(['first@example.com', 'second@example.com']);
    } finally {
      await ctx.orm.User.where({ id: 'u-alice' }).update({ email: 'alice@example.com' });
    }
  });
});

// A resolver on a row without what its type selects gets the type's data whichever plugins are
// installed, and in whichever order.
describe.each([
  ['without scope-auth', [PrismaNextPlugin]],
  ...orders,
] as const)('resolvers on partial rows (%s)', (_, plugins) => {
  function partialSchema() {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    } as never);
    const Related = builder.prismaObject('User', {
      variant: 'Related',
      select: { email: true, posts: true },
      fields: (t) => ({
        summary: t.string({ resolve: (user) => `${user.email} ${user.posts.length}` }),
      }),
    });
    const Columns = builder.prismaObject('User', {
      variant: 'Columns',
      select: ['email'],
      fields: (t) => ({ greeting: t.string({ resolve: (user) => `Hi ${user.email}` }) }),
    });
    const Exposed = builder.prismaObject('User', {
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        related: t.field({ type: Related, resolve: () => ({ id: 'u-alice' }) as never }),
        columns: t.field({ type: Columns, resolve: () => ({ id: 'u-alice' }) as never }),
        exposed: t.field({ type: Exposed, resolve: () => ({ id: 'u-alice' }) as never }),
      }),
    });
    return builder.toSchema();
  }

  it.each([
    ['{ related { summary } }', { related: { summary: 'alice@example.com 2' } }],
    ['{ columns { greeting } }', { columns: { greeting: 'Hi alice@example.com' } }],
    ['{ exposed { firstName } }', { exposed: { firstName: 'Alice' } }],
  ])('%s', async (query, data) => {
    const result = await runCaptured(partialSchema(), query);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual(data);
    expect(result.statements).toHaveLength(1);
  });
});

describe.each(
  orders.flatMap(([name, plugins]) => [
    [name, false, plugins],
    [name, true, plugins],
  ]),
)('rows reloaded for checks (%s, runScopesOnType: %s)', (_, runScopesOnType, plugins) => {
  function reloadSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType },
      prisma: { client: ctx.client },
    });
    const User = builder.prismaObject('User', {
      select: ['email', 'firstName'],
      authScopes: (user) => {
        seen.push([user.email, user.firstName, (user as { nickname?: string }).nickname]);
        return true;
      },
      fields: (t) => ({
        id: t.exposeID('id'),
        firstName: t.string({ resolve: (user) => user.firstName }),
        nickname: t.string({
          nullable: true,
          resolve: (user) => (user as { nickname?: string }).nickname,
        }),
        posts: t.relation('posts'),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    // Mutated between subscription events, each of which also gets it as the root value.
    const eventRow = { id: 'u-alice' };
    builder.queryType({
      fields: (t) => ({
        overridden: t.field({
          type: User,
          resolve: () =>
            ({
              id: 'u-alice',
              firstName: 'Override',
              nickname: 'Al',
              posts: [{ id: 'p-other', title: 'Not loaded' }],
            }) as never,
        }),
      }),
    });
    builder.subscriptionType({
      fields: (t) => ({
        userEvents: t.field({
          type: User,
          subscribe: async function* () {
            for (const id of ['u-alice', 'u-bob']) {
              eventRow.id = id;
              yield await Promise.resolve(eventRow);
            }
          },
          resolve: (row) => row as never,
        }),
      }),
    });
    return builder.toSchema();
  }

  it("replaces the row's columns with loaded ones, keeping its other keys", async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(reloadSchema(seen), '{ overridden { firstName nickname } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ overridden: { firstName: 'Alice', nickname: 'Al' } });
    // The fields and the checks share one reload of the row.
    expect(seen).toEqual([['alice@example.com', 'Alice', 'Al']]);
    expect(result.statements).toHaveLength(1);
  });

  it('reloads a row again for each subscription event', async () => {
    const seen: unknown[] = [];
    const statements: CapturedExecution[] = [];
    const results = await withCapture(statements, async () => {
      const events = await subscribe({
        schema: reloadSchema(seen),
        document: parse('subscription { userEvents { id firstName } }'),
        contextValue: {},
      });
      const collected: unknown[] = [];
      for await (const event of events as AsyncIterable<unknown>) {
        collected.push(event);
      }
      return collected;
    });
    expect(results).toEqual([
      { data: { userEvents: { id: 'u-alice', firstName: 'Alice' } } },
      { data: { userEvents: { id: 'u-bob', firstName: 'Bob' } } },
    ]);
    expect(seen).toEqual([
      ['alice@example.com', 'Alice', undefined],
      ['bob@example.com', 'Bob', undefined],
    ]);
    expect(statements).toHaveLength(2);
  });
});

// A row handed from one type to another of its model, as it is or as another plugin's spread copy
// of it, holds what the type-level selects of the model loaded, which agree.
describe.each(orders)('a row handed to another type of its model (%s)', (_, plugins) => {
  function schema(
    selects: { a: Record<string, unknown>; b: Record<string, unknown> },
    read: (user: Record<string, unknown>) => unknown,
    spread: boolean,
  ) {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    const B = builder.prismaObject('User', {
      variant: 'B',
      select: selects.b as never,
      authScopes: (user) => {
        seen.push(read(user as never));
        return true;
      },
      fields: (t) => ({
        value: t.field({ type: 'JSON' as never, resolve: (user) => read(user as never) as never }),
        nickname: t.string({
          nullable: true,
          resolve: (user) => (user as { nickname?: string }).nickname ?? null,
        }),
        // Reads a column A's plan didn't load, so the row is reloaded.
        label: t.string({
          select: ['email'] as never,
          resolve: (user) => {
            const { email, nickname } = user as { email: string; nickname?: string };
            return `${email} ${nickname}`;
          },
        }),
      }),
    });
    const A = builder.prismaObject('User', {
      variant: 'A',
      select: selects.a as never,
      fields: (t) => ({
        value: t.field({ type: 'JSON' as never, resolve: (user) => read(user as never) as never }),
        asB: t.field({
          type: B,
          resolve: (user) => (spread ? { ...(user as object), nickname: 'Al' } : user) as never,
        }),
      }),
    });
    builder.scalarType('JSON' as never, { serialize: (value: unknown) => value } as never);
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: A, collection: () => ctx.orm.User.where({ id: 'u-alice' }) }),
      }),
    });
    return { schema: builder.toSchema(), seen };
  }
  const published = (user: Record<string, unknown>) =>
    (user.posts as { published: number }[]).map((post) => post.published);

  // Alice has two posts, one of them published.
  describe.each([false, true])('spread: %s', (spread) => {
    const comments = (user: Record<string, unknown>) =>
      (user.comments as unknown[] | undefined)?.length ?? null;

    it('reads the relation both types select', async () => {
      const { schema: built, seen } = schema(
        { a: { comments: true }, b: { comments: true } },
        comments,
        spread,
      );
      const result = await runCaptured(built, '{ user { value asB { value } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.user).toEqual({ value: 1, asB: { value: 1 } });
      expect(seen).toEqual([1]);
      expect(result.statements).toHaveLength(1);
    });

    // B selects no relation, but the row holds A's, and the spread's own key stays.
    it("reads the other type's relation and keeps the keys a spread added", async () => {
      const { schema: built, seen } = schema({ a: { comments: true }, b: {} }, comments, spread);
      const result = await runCaptured(built, '{ user { value asB { value nickname } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.user).toEqual({
        value: 1,
        asB: { value: 1, nickname: spread ? 'Al' : null },
      });
      expect(seen).toEqual([1]);
      expect(result.statements).toHaveLength(1);
    });

    it('keeps the keys a spread added when the row is reloaded', async () => {
      const { schema: built } = schema(
        { a: { comments: true }, b: { comments: true } },
        comments,
        spread,
      );
      const result = await runCaptured(built, '{ user { asB { value label } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.user.asB).toEqual({
        value: 1,
        label: `alice@example.com ${spread ? 'Al' : 'undefined'}`,
      });
    });

    it('reads the filtered rows both types select', async () => {
      const query = { where: { published: 1 } };
      const { schema: built, seen } = schema(
        { a: { posts: query }, b: { posts: query } },
        published,
        spread,
      );
      const result = await runCaptured(built, '{ user { value asB { value } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.user).toEqual({ value: [1], asB: { value: [1] } });
      expect(seen).toEqual([[1]]);
      expect(result.statements).toHaveLength(1);
    });
  });

  it.each([
    [{ posts: { where: { published: 0 } } }, { posts: { where: { published: 1 } } }, 'posts'],
    [{ posts: true }, { posts: { where: { published: 1 } } }, 'posts'],
  ])('rejects types that select a key differently: %j', (a, b, key) => {
    expect(() => schema({ a, b }, () => null, false)).toThrow(
      `'B' and 'A' both select '${key}', with different definitions.`,
    );
  });
});

// A type-level select's filtered relation is the type's own load. Another consumer's load of the
// whole relation sits on the row unbranched, and the type's checks and fields must never read it.
describe.each(orders)("a type's filtered relation beside a whole one (%s)", (_, plugins) => {
  // Bob wrote 'Bob draft'. Alice wrote nothing by that title.
  const bobDraft = { where: { title: 'Bob draft' } } as const;

  function gatedSchema(posts?: { orderBy: { createdAt: 'desc' }; limit: number }) {
    const seen: string[][] = [];
    const record = (posts: readonly { id: string }[]) => {
      seen.push(posts.map((post) => post.id).sort());
    };
    const builder = new SchemaBuilder<{
      PrismaContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prisma: { client: ctx.client },
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const Gated = builder.prismaObject('User', {
      variant: 'GatedAuthor',
      select: { posts: posts ?? bobDraft },
      authScopes: (user) => {
        record(user.posts);
        return user.posts.length > 0;
      },
      fields: (t) => ({
        email: t.exposeString('email'),
        postIds: t.stringList({
          nullable: true,
          resolve: (user) => user.posts?.map((post) => post.id).sort() ?? null,
        }),
        // Loads a relation of its own, and reads the type's.
        commentedPostIds: t.stringList({
          nullable: true,
          select: () => ({ comments: true }),
          resolve: (user) => user.posts?.map((post) => post.id).sort() ?? null,
        }),
      }),
    });
    const GatedComment = builder.prismaObject('Comment', {
      variant: 'GatedComment',
      select: { author: { select: { posts: posts ?? bobDraft } } },
      authScopes: (comment) => {
        record(comment.author.posts);
        return comment.author.posts.length > 0;
      },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        allPosts: t.relation('posts'),
        gated: t.field({ type: Gated, nullable: true, resolve: (user) => user }),
      }),
    });
    builder.prismaObject('Comment', {
      fields: (t) => ({
        id: t.exposeID('id'),
        writer: t.field({
          type: Gated,
          nullable: true,
          select: { author: { select: { posts: true } } },
          resolve: (comment) => comment.author,
        }),
        gated: t.field({
          type: GatedComment,
          nullable: true,
          select: { author: { select: { posts: true } } },
          resolve: (comment) => comment,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
        comments: t.prismaField({
          type: ['Comment'],
          collection: () => ctx.orm.Comment.orderBy((comment) => comment.id.asc()),
        }),
      }),
    });
    return { schema: builder.toSchema(), seen };
  }

  // Type-level authScopes fail each field of the type. c-1 is Bob's comment, c-2 Alice's.
  const denied = (result: { errors?: readonly { path?: unknown }[] }) =>
    result.errors?.map((error) => error.path);

  it("denies a row whose writer's whole relation another select loaded", async () => {
    const { schema: built, seen } = gatedSchema();
    const result = await runCaptured(built, '{ comments { id writer { email } } }');
    expect(result.data.comments).toEqual([
      { id: 'c-1', writer: { email: 'bob@example.com' } },
      { id: 'c-2', writer: { email: null } },
    ]);
    expect(denied(result)).toEqual([['comments', 1, 'writer', 'email']]);
    expect(seen.sort()).toEqual([[], ['p-bob-draft']]);
  });

  it('denies a row a sibling t.relation loaded the whole relation on', async () => {
    const { schema: built, seen } = gatedSchema();
    const result = await runCaptured(built, '{ users { allPosts { id } gated { postIds } } }');
    expect(result.data.users[0].allPosts).toHaveLength(2);
    expect(denied(result)).toEqual([['users', 0, 'gated', 'postIds']]);
    expect(seen.sort()).toEqual([[], ['p-bob-draft']]);
  });

  // A field without a select of its own reads the row the type's checks read.
  it("shows a field of the type the type's own rows", async () => {
    const { schema: built } = gatedSchema();
    const result = await runCaptured(built, '{ users { allPosts { id } gated { postIds } } }');
    expect(result.data.users[1].gated).toEqual({ postIds: ['p-bob-draft'] });
  });

  it("shows a field with a select function the type's own rows", async () => {
    const { schema: built } = gatedSchema();
    const result = await runCaptured(
      built,
      '{ users { allPosts { id } gated { commentedPostIds } } }',
    );
    expect(result.data.users[1].gated).toEqual({ commentedPostIds: ['p-bob-draft'] });
  });

  // Each user's latest post: Alice's 'p-draft1', Bob's 'p-bob-draft'.
  it("hands a limited, ordered relation's checks its own rows", async () => {
    const { schema: built, seen } = gatedSchema({ orderBy: { createdAt: 'desc' }, limit: 1 });
    const result = await runCaptured(built, '{ users { allPosts { id } gated { postIds } } }');
    expect(result.errors).toBeUndefined();
    expect(seen.sort()).toEqual([['p-bob-draft'], ['p-draft1']]);
  });

  it('denies a row whose filtered relation is beneath a to-one select', async () => {
    const { schema: built, seen } = gatedSchema();
    const result = await runCaptured(built, '{ comments { id gated { id } } }');
    expect(result.data.comments).toEqual([
      { id: 'c-1', gated: { id: 'c-1' } },
      { id: 'c-2', gated: { id: null } },
    ]);
    expect(denied(result)).toEqual([['comments', 1, 'gated', 'id']]);
    expect(seen.sort()).toEqual([[], ['p-bob-draft']]);
  });
});
