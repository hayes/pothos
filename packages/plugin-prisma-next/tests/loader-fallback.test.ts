import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import {
  execute,
  experimentalExecuteIncrementally,
  GraphQLDeferDirective,
  parse,
  specifiedDirectives,
} from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin, { type PrismaNextCollections } from '../src';
import {
  type CapturedExecution,
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});

it('batches function selections with conflicting arguments across connection consumer paths', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: { nodesOnConnection: true },
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      count: t.relationCount('posts', {
        args: { published: t.arg.int({ required: true }) },
        where: (post, args) => post.published.eq(args.published),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaConnection({ type: 'User', cursor: 'id', resolve: () => ctx.ormClient.User }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse(
        '{ users(first: 2) { edges { node { count(published: 1) } } nodes { count(published: 9) } } }',
      ),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    users: {
      edges: [{ node: { count: 1 } }, { node: { count: 1 } }],
      nodes: [{ count: 0 }, { count: 0 }],
    },
  });
  expect(captures).toHaveLength(2);
  expect(captures[1].params).toEqual(expect.arrayContaining(['u-alice', 'u-bob']));
});

function schema(
  options: {
    contract?: SampleContract;
    collections?: PrismaNextCollections<SampleContract>;
    skipDeferredFragments?: boolean;
    defer?: boolean;
  } = {},
) {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: {
      contract: options.contract ?? ctx.contract,
      collections: options.collections ?? ctx.ormClient,
      skipDeferredFragments: options.skipDeferredFragments,
    },
  });
  builder.prismaObject('User', {
    select: ['lastName'],
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      fullName: t.string({ resolve: (row) => row.lastName }),
      label: t.string({ select: ['email'], resolve: (row) => row.email }),
      asyncLabel: t.string({
        select: async () => {
          await Promise.resolve();
          return ['email'] as const;
        },
        resolve: (row) => (row as unknown as { email: string }).email,
      }),
      constant: t.string({ resolve: () => 'constant' }),
      posts: t.relation('posts'),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({
      title: t.exposeString('title'),
      author: t.relation('author'),
      alice: t.relation('author', { nullable: true, query: { where: { firstName: 'Alice' } } }),
      bob: t.relation('author', { nullable: true, query: { where: { firstName: 'Bob' } } }),
      nobody: t.relation('author', { nullable: true, query: { where: { firstName: 'Nobody' } } }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({
        type: ['Post'],
        resolve: () => ctx.ormClient.Post.orderBy((p) => p.id.asc()),
      }),
      users: t.prismaField({
        type: ['User'],
        resolve: () => ctx.ormClient.User.orderBy((u) => u.id.asc()),
      }),
    }),
  });
  return builder.toSchema(
    options.defer ? { directives: [...specifiedDirectives, GraphQLDeferDirective] } : {},
  );
}

it('batches compatible consumers across parents and splits incompatible to-one branches', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse(
        '{ posts { nobody { id } a: alice { firstName } a2: alice { id } bob { firstName } } }',
      ),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      ...[0, 1].map(() => ({ nobody: null, a: null, a2: null, bob: { firstName: 'Bob' } })),
      ...[0, 1].map(() => ({
        nobody: null,
        a: { firstName: 'Alice' },
        a2: { id: 'u-alice' },
        bob: null,
      })),
    ],
  });
  expect(captures).toHaveLength(3);
  for (const query of captures.slice(1)) {
    expect(query.sql).toMatch(/\bIN\b/i);
    expect(query.params).toEqual(
      expect.arrayContaining(['p-hello', 'p-draft1', 'p-bob1', 'p-bob-draft']),
    );
  }
});

it('retains the one-query path for compatible selections and dependency-free fields', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse('{ users { constant fullName label firstName } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(captures).toHaveLength(1);
});

it('reloads a conflict beneath shared to-one consumers with independent nested mappings', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse(
        '{ posts { a: author { posts { nobody { id } alice { firstName } } } b: author { posts { bob { firstName } } } } }',
      ),
    }),
  );
  expect(result.errors).toBeUndefined();
  const posts = (
    result.data as {
      posts: {
        a: { posts: { nobody: unknown; alice: unknown }[] };
        b: { posts: { bob: unknown }[] };
      }[];
    }
  ).posts;
  expect(posts).toHaveLength(4);
  expect(posts[0].a.posts.every((post) => post.nobody === null && post.alice === null)).toBe(true);
  expect(posts[0].b.posts.every((post) => post.bob !== null)).toBe(true);
  expect(posts[3].a.posts.every((post) => post.nobody === null && post.alice !== null)).toBe(true);
  expect(posts[3].b.posts.every((post) => post.bob === null)).toBe(true);
  // One initial query and one fallback, regardless of repeated parent identities.
  expect(captures).toHaveLength(2);
});

it('uses a compound identity predicate and maps rows back to every parent', async () => {
  const contract = structuredClone(ctx.contract);
  const tables = Object.values(contract.storage.namespaces).flatMap((namespace) =>
    Object.values(namespace.entries.table ?? {}),
  );
  const post = tables.find((table) => 'title' in table.columns)!;
  (post.primaryKey as unknown as { columns: string[] }).columns = ['authorId', 'id'];
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema({ contract }),
      contextValue: {},
      document: parse('{ posts { nobody { id } alice { firstName } } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(captures).toHaveLength(2);
  expect(captures[1].sql).toMatch(/\bOR\b/);
  expect(captures[1].sql).toMatch(/"authorId".*=.*\bAND\b.*"id"/);
  expect(result.data).toEqual({
    posts: [
      ...[0, 1].map(() => ({ nobody: null, alice: null })),
      ...[0, 1].map(() => ({ nobody: null, alice: { firstName: 'Alice' } })),
    ],
  });
});

it('rejects every affected parent when the provider excludes rows', async () => {
  const result = await execute({
    schema: schema({ collections: { Post: ctx.ormClient.Post.where({ authorId: 'u-alice' }) } }),
    contextValue: {},
    document: parse('{ posts { nobody { id } alice { firstName } } }'),
  });
  expect(result.errors).toHaveLength(2);
  expect(result.errors!.every((error) => /could not find model 'Post'/.test(error.message))).toBe(
    true,
  );
  expect(result.errors!.map((error) => error.path)).toEqual([
    ['posts', 0, 'alice'],
    ['posts', 1, 'alice'],
  ]);
});

it('reports a missing model provider for every parent without hanging the batch', async () => {
  const result = await execute({
    schema: schema({ collections: {} }),
    contextValue: {},
    document: parse('{ posts { nobody { id } alice { firstName } } }'),
  });
  expect(result.errors).toHaveLength(4);
  expect(
    result.errors!.every((error) => /Missing prismaNext.collections entry/.test(error.message)),
  ).toBe(true);
});

it('rejects paginated fallback collections before executing a truncated batch', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema({ collections: { Post: ctx.ormClient.Post.limit(1) } }),
      contextValue: {},
      document: parse('{ posts { nobody { id } alice { firstName } } }'),
    }),
  );
  expect(result.errors).toHaveLength(4);
  expect(result.errors!.every((error) => /must be unpaginated/.test(error.message))).toBe(true);
  expect(captures).toHaveLength(1);
});

it('does not let a reloaded row claim coverage for a sibling resolved later', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  const user = builder.prismaObject('User', {
    fields: (t) => ({ firstName: t.exposeString('firstName') }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.field({
        type: [user],
        resolve: (() => [
          { id: 'u-alice' },
          new Promise((resolve) => setTimeout(() => resolve({ id: 'u-bob' }), 20)),
        ]) as never,
      }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ users { firstName } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ users: [{ firstName: 'Alice' }, { firstName: 'Bob' }] });
  expect(captures).toHaveLength(2);
});

it('loads deferred scalars, custom dependencies, type prerequisites, and relations in one batch', async () => {
  const captures: CapturedExecution[] = [];
  await withCapture(captures, async () => {
    const result = await experimentalExecuteIncrementally({
      schema: schema({ defer: true }),
      contextValue: {},
      document: parse(
        '{ users { id ... @defer { firstName fullName label asyncLabel posts { title } } } }',
      ),
    });
    if (!('initialResult' in result)) {
      throw new Error('Expected incremental result');
    }
    expect(result.initialResult.errors).toBeUndefined();
    expect(captures).toHaveLength(1);
    expect(captures[0].sql).not.toMatch(/firstName|email|title/);
    const patches = [];
    for await (const patch of result.subsequentResults) {
      patches.push(patch);
    }
    expect(
      patches
        .flatMap((patch) => patch.incremental ?? [])
        .map((patch) => ('data' in patch ? patch.data : null)),
    ).toEqual([
      {
        firstName: 'Alice',
        fullName: 'Andrews',
        label: 'alice@example.com',
        asyncLabel: 'alice@example.com',
        posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
      },
      {
        firstName: 'Bob',
        fullName: 'Brown',
        label: 'bob@example.com',
        asyncLabel: 'bob@example.com',
        posts: [{ title: 'Bob writes' }, { title: 'Bob draft' }],
      },
    ]);
    expect(captures).toHaveLength(2);
  });
});

it('keeps deferred loading eager when explicitly configured', async () => {
  const captures: CapturedExecution[] = [];
  await withCapture(captures, async () => {
    const result = await experimentalExecuteIncrementally({
      schema: schema({ skipDeferredFragments: false, defer: true }),
      contextValue: {},
      document: parse('{ users { ... @defer { firstName } } }'),
    });
    if (!('initialResult' in result)) {
      throw new Error('Expected incremental result');
    }
    for await (const patch of result.subsequentResults) {
      expect(patch.completed?.some((entry) => entry.errors)).not.toBe(true);
    }
    expect(captures).toHaveLength(1);
    expect(captures[0].sql).toMatch(/firstName/);
  });
});
