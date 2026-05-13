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

function createRecordingCollection(): RecordingCollection {
  const calls: Recorded[] = [];
  const c: RecordingCollection = {
    calls,
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
  const userCollection = createRecordingCollection();

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
      postCount: t.relationCount('posts'),
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
        // New API: the resolver receives `apply` (an identity-typed wrapper
        // that runs the auto-include mapper). Pass our recording mock
        // through `apply` so the mapper's `.select(...)` / `.include(...)`
        // chain lands on the recording collection, then hand the synthetic
        // rows back to GraphQL by invoking the test's resolverImpl.
        resolve: ((apply: (c: RecordingCollection) => RecordingCollection) => {
          apply(userCollection);
          return resolverImpl(userCollection);
        }) as never,
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
    // Simulate orm-client output: combine result lives under `parent.posts`
    // with named branches. The plugin's reshape lifts each branch onto a
    // flat top-level key so `parent.drafts`, `parent.publishedPosts`, and
    // `parent.postCount` are present when the per-field resolvers run.
    const { schema } = buildSchemaWith(() => [
      {
        id: '1',
        firstName: 'Alice',
        posts: {
          drafts: [{ id: 'd1', title: 'Draft 1' }],
          publishedPosts: [{ id: 'p1', title: 'Published 1' }],
          postCount: 7,
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
});
