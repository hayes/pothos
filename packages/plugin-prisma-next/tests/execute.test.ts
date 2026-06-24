import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import SchemaBuilder from '@pothos/core';
import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract as SampleContract } from './fixtures/sample-contract';

const sampleContract = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/sample-contract.json', import.meta.url)), 'utf8'),
) as SampleContract;

interface Recorded {
  method: string;
  args: unknown[];
}

interface RecordingCollection {
  calls: Recorded[];
  // `all` is a function on the live mock; the test wires it to return
  // the synthetic rows so the plugin's auto-materialize step lands the
  // expected payload. Type as `() => Promise<unknown[]>` so the duck-
  // type check in `isOrmCollection` passes.
  all: () => Promise<unknown[]>;
  select(...names: string[]): RecordingCollection;
  include(
    name: string,
    refine?: (rel: RecordingCollection) => RecordingCollection,
  ): RecordingCollection;
  combine(spec: Record<string, unknown>): RecordingCollection;
  count(): unknown;
  where(input: unknown): RecordingCollection;
  orderBy(input: unknown): RecordingCollection;
  take(n: number): RecordingCollection;
  skip(n: number): RecordingCollection;
}

function createRecordingCollection(
  rows: () => unknown[] | Promise<unknown[]> = () => [],
): RecordingCollection {
  const calls: Recorded[] = [];
  const c: RecordingCollection = {
    calls,
    all: () => Promise.resolve(rows()),
    select(...names) {
      calls.push({ method: 'select', args: names });
      return c;
    },
    include(name, refine) {
      calls.push({ method: 'include', args: [name] });
      if (refine) {
        const child = createRecordingCollection();
        refine(child);
      }
      return c;
    },
    combine(spec) {
      calls.push({ method: 'combine', args: [Object.keys(spec)] });
      return c;
    },
    count() {
      calls.push({ method: 'count', args: [] });
      return { kind: 'count-marker' };
    },
    where(input) {
      calls.push({ method: 'where', args: [input] });
      return c;
    },
    orderBy(input) {
      calls.push({ method: 'orderBy', args: [input] });
      return c;
    },
    take(n) {
      calls.push({ method: 'take', args: [n] });
      return c;
    },
    skip(n) {
      calls.push({ method: 'skip', args: [n] });
      return c;
    },
  };
  return c;
}

function buildSchemaWith(
  resolverImpl: (collection: RecordingCollection) => unknown[] | Promise<unknown[]>,
) {
  // eslint-disable-next-line prefer-const
  let userCollection: RecordingCollection;
  userCollection = createRecordingCollection(() => resolverImpl(userCollection));

  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: sampleContract },
  });

  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id' as never, { nullable: true }),
      firstName: t.exposeString('firstName' as never, { nullable: true }),
      posts: t.relation('posts'),
      drafts: t.relation('posts', {
        query: { where: { published: 0 } } as never,
      }),
      publishedPosts: t.relation('posts', {
        query: { where: { published: 1 } } as never,
      }),
      // Function-form select replaces the (removed) t.relationCount sugar.
      postCount: t.field({
        type: 'Int',
        select: {
          posts: (sub: { count: () => unknown }) => ({ posts: sub.count() }),
        },
        resolve: ((parent: { posts: number }) => parent.posts) as never,
      } as never),
    }),
  });

  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id' as never, { nullable: true }),
      title: t.exposeString('title' as never, { nullable: true }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        // New API: resolver returns the Collection directly. Plugin's
        // wrapResolve auto-detects via duck-typed `.select`+`.all`,
        // calls `applySelectionToCollection` (driving the mapper's
        // recorded calls), then `.all()` (driving the test's
        // resolverImpl to produce synthetic rows).
        resolve: (() => userCollection) as never,
      }),
    }),
  });

  return { schema: builder.toSchema(), userCollection };
}

describe('plugin · end-to-end execution', () => {
  it('hands the user resolver a Collection on which the mapper has applied select + include', async () => {
    const { schema, userCollection } = buildSchemaWith(() => []);

    await execute({
      schema,
      document: parse('{ users { id firstName posts { id title } } }'),
    });

    // The mapper should have called .select(...) and .include('posts', ...)
    // on the base collection before the resolver ran.
    const selectCall = userCollection.calls.find((c) => c.method === 'select');
    expect(selectCall).toBeDefined();
    expect([...((selectCall?.args as string[]) ?? [])].sort()).toEqual(['firstName', 'id']);

    const includeCall = userCollection.calls.find((c) => c.method === 'include');
    expect(includeCall).toBeDefined();
    expect(includeCall?.args).toEqual(['posts']);
  });

  it('reshapes combine branches onto flat parent keys before relation resolvers run', async () => {
    // Simulate orm-client output: combine result lives under `parent.posts`.
    // All sugar methods (`t.relation` / `t.relatedConnection` / etc.)
    // and direct `t.field({ select })` compile to the unified `select`
    // option, which namespaces combine slots as `<fieldAlias>:<specKey>`.
    const { schema } = buildSchemaWith(() => [
      {
        id: '1',
        firstName: 'Alice',
        posts: {
          'drafts:posts': [{ id: 'd1', title: 'Draft 1' }],
          'publishedPosts:posts': [{ id: 'p1', title: 'Published 1' }],
          'postCount:posts': 7,
        },
      },
    ]);

    const result = await execute({
      schema,
      document: parse(`{
        users {
          id
          firstName
          drafts { id title }
          publishedPosts { id title }
          postCount
        }
      }`),
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        {
          id: '1',
          firstName: 'Alice',
          drafts: [{ id: 'd1', title: 'Draft 1' }],
          publishedPosts: [{ id: 'p1', title: 'Published 1' }],
          postCount: 7,
        },
      ],
    });
  });

  it('passes plain-include results through to relation resolvers when alias === relationName', async () => {
    const { schema } = buildSchemaWith(() => [
      {
        id: '1',
        firstName: 'Alice',
        posts: [
          { id: 'p1', title: 'P1' },
          { id: 'p2', title: 'P2' },
        ],
      },
    ]);

    const result = await execute({
      schema,
      document: parse('{ users { id posts { id title } } }'),
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        {
          id: '1',
          posts: [
            { id: 'p1', title: 'P1' },
            { id: 'p2', title: 'P2' },
          ],
        },
      ],
    });
  });

  it('returns null at the prismaField when the resolver returns null', async () => {
    // Single, nullable prismaField. The reshape function must safely no-op
    // on a null result (the plugin's wrapResolve checks for `result == null`
    // before invoking reshape).
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id' as never, { nullable: true }) }),
    });
    builder.queryType({
      fields: (t) => ({
        userById: t.prismaField({
          type: 'User',
          nullable: true,
          resolve: (() => null) as never,
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ userById { id } }'),
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ userById: null });
  });

  it('throws a clear error if t.relation is reached without t.prismaField loading the parent', async () => {
    // An ordinary `t.field` on Query that returns a User row — the mapper
    // never ran on this branch, so `parent.posts` is missing. The plugin's
    // wrapResolve for t.relation should surface a precise error.
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });

    const userRef = builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id' as never, { nullable: true }),
        posts: t.relation('posts'),
      }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ id: t.exposeID('id' as never, { nullable: true }) }),
    });

    builder.queryType({
      fields: (t) => ({
        // Bypass prismaField entirely — return a row that the mapper never
        // saw. Use the ref directly with t.field so we exercise the
        // non-prismaField path that surfaces the relation error.
        rawUser: t.field({
          type: userRef,
          resolve: () => ({ id: '1' }) as never,
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ rawUser { id posts { id } } }'),
    });

    expect(result.errors).toBeDefined();
    const messages = (result.errors ?? []).map((e) => e.message).join('\n');
    expect(messages).toMatch(/t\.prismaField/);
    expect(messages).toMatch(/posts/);
  });

  it('throws a clear error when select names an unknown column on the parent model', async () => {
    let userCollection: RecordingCollection;
    userCollection = createRecordingCollection(() => [{ id: '1' }]);

    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id' as never, { nullable: true }),
        // `firstNme` is a typo — must throw, not silently load nothing.
        garbled: t.string({
          select: { firstNme: true } as never,
          resolve: () => 'x' as never,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => userCollection) as never,
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users { id garbled } }'),
    });
    expect(result.errors).toBeDefined();
    const msg = (result.errors ?? []).map((e) => e.message).join('\n');
    expect(msg).toMatch(/firstNme/);
    expect(msg).toMatch(/not a column or relation/);
  });

  it('throws a clear error when a select entry has a malformed object shape', async () => {
    let userCollection: RecordingCollection;
    userCollection = createRecordingCollection(() => [{ id: '1' }]);

    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id' as never, { nullable: true }),
        // `whre` is a typo for `where` — not declarative, not function;
        // should throw rather than silently drop.
        garbled: t.string({
          select: { posts: { whre: { published: 1 } } } as never,
          resolve: () => 'x' as never,
        }),
      }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id' as never, { nullable: true }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => userCollection) as never,
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users { id garbled } }'),
    });
    expect(result.errors).toBeDefined();
    const msg = (result.errors ?? []).map((e) => e.message).join('\n');
    expect(msg).toMatch(/unrecognized value shape/);
  });

  it('injects .take(1) when prismaField returns a single (non-list) type', async () => {
    // Regression test: a single-row prismaField returning a Collection
    // must auto-inject `.take(1)` so we don't fetch the entire table
    // just to read the first row.
    let single: RecordingCollection;
    single = createRecordingCollection(() => [{ id: 'u-1', firstName: 'Alice' }]);

    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id' as never, { nullable: true }),
        firstName: t.exposeString('firstName' as never, { nullable: true }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        firstUser: t.prismaField({
          type: 'User',
          nullable: true,
          resolve: (() => single) as never,
        }),
        // List variant should NOT inject take.
        allUsers: t.prismaField({
          type: ['User'],
          resolve: (() => single) as never,
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ firstUser { id } }'),
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ firstUser: { id: 'u-1' } });
    const takeCalls = single.calls.filter((c) => c.method === 'take');
    expect(takeCalls).toHaveLength(1);
    expect(takeCalls[0]?.args).toEqual([1]);

    // Reset and re-run as a list — no .take this time.
    single.calls.length = 0;
    const result2 = await execute({
      schema: builder.toSchema(),
      document: parse('{ allUsers { id } }'),
    });
    expect(result2.errors).toBeUndefined();
    const listTakeCalls = single.calls.filter((c) => c.method === 'take');
    expect(listTakeCalls).toHaveLength(0);
  });

  it('lifts combine slots through a variant-wrapped parent (overlay prototype walk)', async () => {
    // Regression test: rebrandForVariant wraps via Object.create(parent),
    // so row data sits on the prototype chain. The per-field overlay
    // walk in wrapResolve must use `for...in` (prototype-walking) to
    // find combine slots — using `Object.keys` would only see own
    // properties of the wrapper (which has none besides the brand).
    let userCollection: RecordingCollection;
    userCollection = createRecordingCollection(() => [
      {
        id: '1',
        firstName: 'Alice',
        posts: { 'postCount:posts': 11 },
      },
    ]);

    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });
    const userBasicRef = builder.prismaObject('User', {
      name: 'UserBasic',
      fields: (t) => ({
        id: t.exposeID('id' as never, { nullable: true }),
        // Function-form select on the variant — the field's resolver
        // reads `parent.posts` which is only correct if the overlay
        // lifted `posts:postCount:posts` from the prototype-inherited
        // combine slot.
        postCount: t.field({
          type: 'Int',
          select: {
            posts: (sub: { count: () => unknown }) => ({ posts: sub.count() }),
          },
          resolve: ((parent: { posts: number }) => parent.posts) as never,
        } as never),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id' as never, { nullable: true }),
        // Re-expose as UserBasic on the same row.
        basicView: t.variant(userBasicRef),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => userCollection) as never,
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users { id basicView { id postCount } } }'),
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [{ id: '1', basicView: { id: '1', postCount: 11 } }],
    });
  });
});
