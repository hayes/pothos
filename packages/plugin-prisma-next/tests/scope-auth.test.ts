// biome-ignore-all lint/suspicious/noExplicitAny: the shared-walk schema names variants in loops
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import {
  execute,
  experimentalExecuteIncrementally,
  GraphQLDeferDirective,
  type GraphQLSchema,
  parse,
  specifiedDirectives,
} from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import {
  type CapturedExecution,
  createSqliteRuntime,
  createTestRuntime,
  loadContract,
  type SampleContract,
  type SqliteRuntime,
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
    CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL);
    INSERT INTO user VALUES ('u1', 'a@example.com');
    INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'), ('t2', 'feat1', 'feature', 'u1', NULL, 'u1');
    INSERT INTO feature VALUES ('t2', 5);
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
    PrismaNextContract: SampleContract;
    Context: { admin: boolean };
    AuthScopes: { admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: ({ admin }) => ({ admin }) },
    prismaNext: { client: ctx.client },
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
        resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
      privateUser: t.withAuth({ admin: true }).prismaField({
        type: 'User',
        nullable: true,
        resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
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
    PrismaNextContract: SampleContract;
    Context: { admin: boolean };
    AuthScopes: { admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: ({ admin }) => ({ admin }) },
    prismaNext: { client: ctx.client },
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

it('loads declared columns and the exposed column for authScopes', async () => {
  const seen: Record<string, unknown> = {};
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    AuthScopes: { open: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({ open: true }) },
    prismaNext: { client: ctx.client },
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
        resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
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
  ['scope-auth first', [ScopeAuthPlugin, prismaNextPlugin]],
  ['prismaNext first', [prismaNextPlugin, ScopeAuthPlugin]],
] as const;

describe.each(orders)("an implementation's select under an interface (%s)", (_, plugins) => {
  function variantSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaNextContract: InheritanceContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: inheritanceDb.client },
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
          resolve: () => inheritanceDb.orm.Task.orderBy((row) => row.id.asc()),
        }),
        users: t.prismaField({ type: ['User'], resolve: () => inheritanceDb.orm.User }),
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
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
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
          resolve: () => ctx.orm.User.orderBy((user) => user.id.asc()),
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

it("reloads a hand-built row for an implementation's authScopes (prismaNext first)", async () => {
  const seen: unknown[] = [];
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    AuthScopes: { ok: boolean };
  }>({
    plugins: [prismaNextPlugin, ScopeAuthPlugin],
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prismaNext: { client: ctx.client },
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
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
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
          resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
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
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        publishedCount: t.int({
          select: { posts: { where: { published: 1 } } },
          authScopes: (user) => {
            seen.push(Array.isArray(user.posts) ? user.posts.length : user.posts);
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
          resolve: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  it.each([
    '{ users { publishedCount } }',
    '{ users { publishedCount all { id } } }',
  ])('see the rows the field selects, whatever else the query selects: %s', async (query) => {
    const seen: unknown[] = [];
    const result = await runCaptured(fieldAuthSchema(seen), query);
    expect(result.errors).toBeUndefined();
    expect(
      result.data.users.map((user: { publishedCount: number }) => user.publishedCount),
    ).toEqual([1, 1]);
    expect(seen).toEqual([1, 1]);
    expect(result.statements).toHaveLength(1);
  });
});

describe.each(orders)('field-level authScopes on a reloaded parent (%s)', (order, plugins) => {
  // A reload runs inside this plugin's resolver wrapper, so a plugin listed before it sees the
  // row as it was handed over.
  const reloadedFirst = order === 'prismaNext first';
  function reloadSchema(seen: unknown[], defer = false) {
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
    });
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        label: t.string({
          select: ['email'],
          authScopes: (user) => {
            seen.push(user.email);
            return true;
          },
          resolve: (user) => user.email,
        }),
        postCount: t.int({
          select: { posts: true },
          authScopes: (user) => {
            seen.push(Array.isArray(user.posts) ? user.posts.length : user.posts);
            return true;
          },
          resolve: (user) => user.posts.length,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        handBuilt: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) as never }),
        user: t.prismaField({
          type: 'User',
          resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    return defer
      ? builder.toSchema({ directives: [...specifiedDirectives, GraphQLDeferDirective] })
      : builder.toSchema();
  }

  it('see the columns a reload adds to a hand-built row only when listed after this plugin', async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(reloadSchema(seen), '{ handBuilt { label } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ handBuilt: { label: 'alice@example.com' } });
    expect(seen).toEqual([reloadedFirst ? 'alice@example.com' : undefined]);
  });

  it('see the relation a reload adds for a deferred field only when listed after this plugin', async () => {
    const seen: unknown[] = [];
    const result = await experimentalExecuteIncrementally({
      schema: reloadSchema(seen, true),
      document: parse('{ user { label ... @defer { postCount } } }'),
      contextValue: {},
    });
    if (!('initialResult' in result)) {
      throw new Error('Expected an incremental result');
    }
    for await (const _patch of result.subsequentResults) {
      // drain
    }
    expect(seen).toEqual(['alice@example.com', reloadedFirst ? 2 : undefined]);
  });
});

describe('rows a connection helper wraps', () => {
  function helperSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
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
    const helper = prismaConnectionHelpers(builder, User, {});
    builder.queryType({
      fields: (t) => ({
        users: t.connection({
          type: User,
          resolve: async (_root, args, context, info) => {
            const page = await helper.applyPagination(ctx.orm.User, args, context, info);
            return page.wrap(await page.collection.all()) as never;
          },
        }),
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

// With `runScopesOnType`, type-level authScopes run from `isTypeOf`, on the row the parent field
// resolved. Two implementations of an interface, reached from a root list and from a relation.
type AdminPostSelect = true | { readonly where: { readonly published: 1 } } | undefined;

describe.each(orders)('runScopesOnType through an interface (%s)', (order, plugins) => {
  function runScopesSchema(seen: unknown[], adminPosts: AdminPostSelect) {
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: true },
      prismaNext: { client: ctx.client },
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
          resolve: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => ctx.orm.Post.where({ id: 'p-bob1' }),
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

  if (order === 'prismaNext first') {
    it('loads the relation each implementation selects with different arguments', async () => {
      const { rootSeen, relationSeen } = await run({ where: { published: 1 } });
      expect(rootSeen).toEqual([['Admin', 'alice@example.com', ['p-hello']], memberSeen]);
      expect(relationSeen).toEqual([memberSeen]);
    });
  } else {
    // Scope-auth's `isTypeOf` wraps this plugin's, so it reads the shared row, which holds neither
    // implementation's `posts`. The setup docs say to list prismaNextPlugin first for this.
    it('hands neither implementation the relation when they select it with different arguments', async () => {
      const { rootSeen, relationSeen } = await run({ where: { published: 1 } });
      expect(rootSeen).toEqual([
        ['Admin', 'alice@example.com', undefined],
        ['Member', 'bob@example.com', undefined],
      ]);
      expect(relationSeen).toEqual([['Member', 'bob@example.com', undefined]]);
    });
  }
});

describe('rows another field filtered', () => {
  const orders = [
    ['before', [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin]],
    ['after', [RelayPlugin, prismaNextPlugin, ScopeAuthPlugin]],
  ] as const;

  function auditBuilder(plugins: readonly unknown[]) {
    return new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: plugins as never,
      relay: {},
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
    });
  }

  // The second field of `drafts` loads the same query as the first, so both share one slot.
  const queries = [
    ['one filtering consumer', '{ users { drafts { id } audited { id } } }'],
    ['two filtering consumers', '{ users { drafts { id } again: drafts { id } audited { id } } }'],
  ];

  describe.each(orders)('scope auth %s the prisma plugin', (_name, plugins) => {
    it.each(queries)('hides them from a type-level select with %s', async (_label, source) => {
      const seen: { auth: unknown[]; isTypeOf: unknown[] } = { auth: [], isTypeOf: [] };
      const builder = auditBuilder(plugins);
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      const Audited = builder.prismaObject('User', {
        variant: 'Audited',
        select: { posts: true },
        authScopes: (user) => {
          seen.auth.push(user.posts?.map((post) => post.id));
          return true;
        },
        isTypeOf: (user) => {
          seen.isTypeOf.push(user.posts?.map((post) => post.id));
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
            resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
          }),
        }),
      });
      const result = await runCaptured(builder.toSchema(), source);
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toMatchObject([
        { drafts: [{ id: 'p-draft1' }], audited: { id: 'u-alice' } },
      ]);
      for (const ids of [...seen.auth, ...seen.isTypeOf]) {
        expect(ids === undefined || (ids as string[]).length === 2).toBe(true);
      }
      expect(seen.auth.length).toBeGreaterThan(0);
      expect(seen.isTypeOf.length).toBeGreaterThan(0);
    });

    it('hides them from a resolveType', async () => {
      const seen: unknown[] = [];
      const builder = auditBuilder(plugins);
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      const Audited = builder.prismaInterface('User', {
        variant: 'AuditedNode',
        select: { posts: true },
        resolveType: (user) => {
          seen.push(user.posts?.map((post) => post.id));
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
            resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
          }),
        }),
      });
      const result = await runCaptured(
        builder.toSchema(),
        '{ users { drafts { id } audited { id } } }',
      );
      expect(result.errors).toBeUndefined();
      expect(seen).toHaveLength(1);
      expect(seen[0] === undefined || (seen[0] as string[]).length === 2).toBe(true);
    });
  });
});

describe('a field that reloads a to-one relation with its own query', () => {
  describe.each([
    ['before', [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin]],
    ['after', [RelayPlugin, prismaNextPlugin, ScopeAuthPlugin]],
  ] as const)('scope auth %s the prisma plugin', (_name, plugins) => {
    function byAliceSchema(seen: unknown[], postsField: 'rows' | 'plain') {
      const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
        plugins: plugins as never,
        relay: {},
        scopeAuth: { authScopes: () => ({ ok: true }) },
        prismaNext: { client: ctx.client },
      });
      builder.prismaObject('User', {
        fields: (t) => ({ firstName: t.exposeString('firstName') }),
      });
      const Post = builder.prismaObject('Post', {
        select: { author: true },
        fields: (t) => ({
          byAlice: t.relation('author', {
            query: { where: { firstName: 'Alice' } },
            authScopes: (post) => {
              seen.push(post.author ? post.author.firstName : post.author);
              return true;
            },
          }),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          post:
            postsField === 'rows'
              ? t.prismaField({
                  type: 'Post',
                  nullable: true,
                  resolve: () => ctx.orm.Post.where({ id: 'p-bob1' }),
                })
              : // A cast row without the selected author, which the types otherwise reject.
                t.field({ type: Post, resolve: () => ({ id: 'p-bob1' }) as never }),
        }),
      });
      return builder.toSchema();
    }

    it('shows field authScopes the declared relation when the parent has it', async () => {
      const seen: unknown[] = [];
      const result = await runCaptured(
        byAliceSchema(seen, 'rows'),
        '{ post { byAlice { firstName } } }',
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.post.byAlice).toBeNull();
      expect(seen).toEqual(['Bob']);
    });

    it('never shows field authScopes the filtered relation as the declared one', async () => {
      const seen: unknown[] = [];
      const result = await runCaptured(
        byAliceSchema(seen, 'plain'),
        '{ post { byAlice { firstName } } }',
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.post.byAlice).toBeNull();
      expect(seen.every((name) => name === undefined || name === 'Bob')).toBe(true);
    });
  });
});

describe('a filtered to-one relation beside a field that selects the declared one', () => {
  describe.each([
    ['before', [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin]],
    ['after', [RelayPlugin, prismaNextPlugin, ScopeAuthPlugin]],
  ] as const)('scope auth %s the prisma plugin', (_name, plugins) => {
    function denyBobSchema() {
      const builder = new SchemaBuilder<{
        PrismaNextContract: SampleContract;
        AuthScopes: { allowed: boolean; never: boolean };
      }>({
        plugins: plugins as never,
        relay: {},
        scopeAuth: { authScopes: () => ({ allowed: true, never: false }) },
        prismaNext: { client: ctx.client },
      });
      builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.prismaObject('Post', {
        fields: (t) => ({
          id: t.exposeID('id'),
          alice: t.relation('author', { query: { where: { firstName: 'Alice' } } }),
          // A deny-list: hides the content of Bob's posts.
          content: t.string({
            nullable: true,
            select: { author: true, content: true },
            authScopes: (post) =>
              post.author?.id === 'u-bob' ? { never: true } : { allowed: true },
            resolve: (post) => post.content,
          }),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          posts: t.prismaField({
            type: ['Post'],
            resolve: () => ctx.orm.Post.orderBy((post) => post.id.asc()),
          }),
        }),
      });
      return builder.toSchema();
    }

    it.each([
      '{ posts { id content } }',
      '{ posts { id alice { id } content } }',
      '{ posts { id content alice { id } } }',
    ])('shows authScopes the declared relation: %s', async (source) => {
      const result = await runCaptured(denyBobSchema(), source);
      expect(result.errors?.map((error) => error.message)).toEqual([
        'Not authorized to resolve Post.content',
        'Not authorized to resolve Post.content',
      ]);
      expect(
        result.data.posts.map(({ id, content }: { id: string; content: unknown }) => [id, content]),
      ).toEqual([
        ['p-bob-draft', null],
        ['p-bob1', null],
        ['p-draft1', 'WIP'],
        ['p-hello', 'Welcome.'],
      ]);
      if (source.includes('alice')) {
        expect(result.data.posts.map((post: { alice: unknown }) => post.alice)).toEqual([
          null,
          null,
          { id: 'u-alice' },
          { id: 'u-alice' },
        ]);
      }
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
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
      relay: { nodesOnConnection: true },
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
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
      nPub: t.relationCount('posts', { where: { published: 1 } }),
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
      select: { firstName: true, posts: (sub: any) => ({ total: sub.count() }) },
      fields: (t: any) => ({ own: dra(t), total: t.int({ resolve: (u: any) => u.total }) }),
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
    for (const [n, published] of [
      ['P1', 1],
      ['P2', 0],
    ] as const) {
      b.prismaObject('Post', {
        variant: n,
        interfaces: [PI, L],
        select: { published: true, comments: true },
        isTypeOf: (p: any) => {
          seen.push(['isTypeOf', n, p.published]);
          return p.published === published;
        },
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
          resolve: () => ctx.orm.User.orderBy((u: any) => u.id.asc()),
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P1",1]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P1",1]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P1",1]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P1",1]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
      seen: ['["isTypeOf","P1",1]', '["resolveType","Alice"]', '["resolveType","Bob"]'],
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P1",1]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P1",1]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
        '["isTypeOf","P1",0]',
        '["isTypeOf","P1",1]',
        '["isTypeOf","P2",0]',
        '["resolveType","Alice"]',
        '["resolveType","Bob"]',
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
