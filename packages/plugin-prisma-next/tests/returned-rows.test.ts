// Type-level authScopes run before this plugin's resolver wrappers when ScopeAuthPlugin is listed
// first, so they read a row before any reload. A field returning a type must resolve to a row
// holding what the type's select loads, which the types enforce, so the checks see it.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute, type GraphQLSchema, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

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
    plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
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
      plainPost: t.field({ type: Post, nullable: true, resolve: fullRow }),
      branded: t.field({
        type: Node,
        nullable: true,
        resolve: async () => {
          const row = await fullRow();
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
