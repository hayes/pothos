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
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary response data
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
      postCount: t.withAuth({ admin: true }).relationCount('posts', { nullable: true }),
      postConnection: t
        .withAuth({ admin: true })
        .relatedConnection('posts', { cursor: 'id', nullable: true }),
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
      '{ user { firstName email adminView { email } posts { title } postCount postConnection { edges { node { title } } } } }',
    ),
    contextValue: { admin: false },
  });
  expect(result.errors).toHaveLength(5);
  expect(result.data).toEqual({
    user: {
      firstName: 'Alice',
      email: null,
      adminView: null,
      posts: null,
      postCount: null,
      postConnection: null,
    },
  });
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
      name: 'Named',
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
    name: 'Named',
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
    const helper = prismaConnectionHelpers(builder, User, { cursor: 'id' });
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
