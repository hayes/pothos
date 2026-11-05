import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import { graphql } from 'graphql';
import type PrismaTypes from '../prisma/generated';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';

// Lives here rather than in plugin-prisma, which can't depend on scope-auth.

let queries = 0;
const client = db.$extends({
  query: {
    $allOperations: ({ args, query }) => {
      queries += 1;
      return query(args);
    },
  },
});

const seen: unknown[] = [];
const authorOf = (post: { author?: { firstName: string } }) =>
  post.author === undefined ? 'missing' : post.author.firstName;

function createSchema(scopeAuthFirst: boolean, runScopesOnType: boolean) {
  const builder = new SchemaBuilder<{
    PrismaTypes: PrismaTypes;
    Context: {};
    AuthScopes: { ok: boolean };
  }>({
    plugins: scopeAuthFirst ? [ScopeAuthPlugin, PrismaPlugin] : [PrismaPlugin, ScopeAuthPlugin],
    prisma: { client: client as never, dmmf: getDatamodel() },
    scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType },
  });

  const User = builder.prismaObject('User', {
    select: { id: true, firstName: true },
    authScopes: (user) => {
      seen.push(user.firstName);
      return true;
    },
    fields: (t) => ({
      id: t.id({ resolve: (user) => user.id }),
      firstName: t.string({ nullable: true, resolve: (user) => user.firstName }),
    }),
  });

  const Post = builder.prismaObject('Post', {
    include: { author: true },
    fields: (t) => ({
      title: t.string({ resolve: (post) => post.title }),
      authorName: t.string({
        nullable: true,
        authScopes: (post) => {
          seen.push([post.title, authorOf(post)]);
          return true;
        },
        resolve: (post) => post.author?.firstName,
      }),
    }),
  });

  const IfacePost = builder.prismaInterface('Post', {
    variant: 'IfacePost',
    resolveType: () => 'ImplPost',
    fields: (t) => ({
      ifaceTitle: t.string({
        authScopes: (post) => {
          seen.push(authorOf(post as { author?: { firstName: string } }));
          return true;
        },
        resolve: (post) => post.title,
      }),
    }),
  });

  builder.prismaObject('Post', {
    variant: 'ImplPost',
    interfaces: [IfacePost],
    include: { author: true },
    fields: () => ({}),
  });

  const NoFallbackPost = builder.prismaObject('Post', {
    variant: 'NoFallbackPost',
    findUnique: null,
    include: { author: true },
    authScopes: (post) => {
      seen.push(authorOf(post));
      return true;
    },
    fields: (t) => ({
      title: t.string({ resolve: (post) => post.title }),
    }),
  });

  const UncheckedUser = builder.prismaObject('User', {
    variant: 'UncheckedUser',
    select: { id: true, firstName: true },
    fields: (t) => ({
      firstName: t.string({ nullable: true, resolve: (user) => user.firstName }),
    }),
  });

  // Returned by every mutation, which run one after the other.
  const sharedRow = { id: 1 };

  builder.mutationType({
    fields: (t) => ({
      touch: t.field({ type: User, resolve: () => sharedRow as never }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      // Plain fields returning rows the plugin didn't load.
      partialUser: t.field({ type: User, resolve: () => ({ id: 1 }) as never }),
      partialPost: t.field({
        type: Post,
        resolve: () => client.post.findUniqueOrThrow({ where: { id: 1 } }) as never,
      }),
      partialPosts: t.field({
        type: [Post],
        resolve: () =>
          client.post.findMany({ where: { id: { in: [1, 2] } }, orderBy: { id: 'asc' } }) as never,
      }),
      partialIfacePost: t.field({
        type: IfacePost,
        resolve: () => client.post.findUniqueOrThrow({ where: { id: 1 } }) as never,
      }),
      noFallbackPost: t.field({
        type: NoFallbackPost,
        resolve: () => client.post.findUniqueOrThrow({ where: { id: 1 } }) as never,
      }),
      redactedPost: t.field({
        type: Post,
        resolve: () => ({ id: 1, title: 'redacted' }) as never,
      }),
      completeUser: t.field({
        type: User,
        resolve: () => ({ id: 1, firstName: 'complete' }) as never,
      }),
      uncheckedUser: t.field({ type: UncheckedUser, resolve: () => ({ id: 1 }) as never }),
      missingUser: t.field({
        type: User,
        nullable: true,
        resolve: () => ({ id: 999_999 }) as never,
      }),
      post: t.prismaField({
        type: Post,
        resolve: (query) => client.post.findUniqueOrThrow({ ...query, where: { id: 1 } }),
      }),
    }),
  });

  return builder.toSchema();
}

let authors: Map<number, string>;
let firstName: string;

beforeAll(async () => {
  const posts = await db.post.findMany({
    where: { id: { in: [1, 2] } },
    include: { author: true },
  });
  authors = new Map(posts.map((post) => [post.id, post.author.firstName]));
  firstName = (await db.user.findUniqueOrThrow({ where: { id: 1 } })).firstName;
});

beforeEach(() => {
  queries = 0;
  seen.length = 0;
});

describe.each([
  [true, false],
  [false, false],
  [true, true],
  [false, true],
])('prisma rows the plugin did not load (scope-auth first: %s, runScopesOnType: %s)', (scopeAuthFirst, runScopesOnType) => {
  const schema = createSchema(scopeAuthFirst, runScopesOnType);
  const run = (source: string) => graphql({ schema, source, contextValue: {} });

  it("passes type authScopes the row with the type's select, and resolvers the original", async () => {
    const result = await run('{ partialUser { id firstName } }');

    expect(result).toEqual({ data: { partialUser: { id: '1', firstName: null } } });
    expect(seen).toEqual([firstName]);
    expect(queries).toBe(1);
  });

  it("uses the implementing type's include for a field the interface declares", async () => {
    const result = await run('{ partialIfacePost { ifaceTitle } }');

    expect(result.errors).toBeUndefined();
    expect(seen).toEqual([authors.get(1)]);
  });

  it('reloads the rows of a list together', async () => {
    const result = await run('{ partialPosts { authorName } }');

    expect(result.errors).toBeUndefined();
    expect(seen).toEqual([
      [expect.any(String), authors.get(1)],
      [expect.any(String), authors.get(2)],
    ]);
    // The root query, and one findUnique per row, which prisma batches.
    expect(queries).toBe(3);
  });

  it("passes field authScopes the type's include, keeping the values the row has", async () => {
    const result = await run('{ redactedPost { title authorName } }');

    expect(result).toEqual({ data: { redactedPost: { title: 'redacted', authorName: null } } });
    expect(seen).toEqual([['redacted', authors.get(1)]]);
    expect(queries).toBe(1);
  });

  it('does not reload a row with the type select, or one the plugin loaded', async () => {
    const result = await run('{ completeUser { firstName } post { authorName } }');

    expect(result).toEqual({
      data: { completeUser: { firstName: 'complete' }, post: { authorName: authors.get(1) } },
    });
    expect(queries).toBe(1);
  });

  it('does not reload without checks', async () => {
    const result = await run('{ uncheckedUser { firstName } }');

    expect(result).toEqual({ data: { uncheckedUser: { firstName: null } } });
    expect(queries).toBe(0);
  });

  it('does not reload a type that opted out of fallback queries', async () => {
    const result = await run('{ noFallbackPost { title } }');

    expect(result.errors).toBeUndefined();
    expect(seen).toEqual(['missing']);
    expect(queries).toBe(1);
  });

  it('fails with a generic error when the reload fails', async () => {
    const result = await run('{ missingUser { firstName } }');

    expect(result.errors?.map((error) => error.message)).toEqual(['Unexpected error.']);
    expect((result.errors?.[0].originalError as Error).cause).toBeInstanceOf(Error);
  });

  it('reloads a row again for each root field', async () => {
    const result = await run('mutation { a: touch { id } b: touch { id } }');

    expect(result.errors).toBeUndefined();
    expect(queries).toBe(2);
  });
});
