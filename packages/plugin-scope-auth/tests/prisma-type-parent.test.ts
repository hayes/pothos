import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import { execute } from '@pothos/test-utils';
import type { GraphQLResolveInfo } from 'graphql';
import { gql } from 'graphql-tag';
import type PrismaTypes from '../prisma/generated';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin, { type ScopeAuthParentLoader } from '../src';
import { db } from './example/db';

// Lives here rather than in plugin-prisma, which can't depend on scope-auth: scope-auth depends
// on plugin-prisma for these tests.

let queries = 0;
const client = db.$extends({
  query: {
    $allOperations: ({ args, query }) => {
      queries += 1;
      return query(args);
    },
  },
});

const seen: { post: unknown[]; user: unknown[]; impl: unknown[] } = {
  post: [],
  user: [],
  impl: [],
};

const authorOf = (post: { author?: { firstName: string } }) =>
  post.author === undefined ? 'missing' : post.author.firstName;

// scope-auth is listed first, and its type checks run from `isTypeOf`, before any field resolves.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: {};
  AuthScopes: { ok: boolean };
}>({
  plugins: [ScopeAuthPlugin, PrismaPlugin],
  prisma: { client: client as never, dmmf: getDatamodel() },
  scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: true },
});

const Post = builder.prismaObject('Post', {
  include: { author: true },
  authScopes: (post) => {
    seen.post.push(authorOf(post));
    return true;
  },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const SelectUser = builder.prismaObject('User', {
  variant: 'SelectUser',
  select: { id: true, firstName: true },
  authScopes: (user) => {
    seen.user.push(user.firstName);
    return true;
  },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const NoSelectUser = builder.prismaObject('User', {
  variant: 'NoSelectUser',
  authScopes: () => true,
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const IfacePost = builder.prismaInterface('Post', {
  variant: 'IfacePost',
  resolveType: () => 'ImplPost',
  fields: (t) => ({
    ifaceId: t.exposeID('id'),
  }),
});

builder.prismaObject('Post', {
  variant: 'ImplPost',
  interfaces: [IfacePost],
  include: { author: true },
  authScopes: (post) => {
    seen.impl.push(authorOf(post));
    return true;
  },
  fields: () => ({}),
});

builder.queryType({
  fields: (t) => ({
    planned: t.prismaField({
      type: Post,
      resolve: (query) => client.post.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    // Rows without the type's include, which is what these fields are for.
    plain: t.field({
      type: Post,
      resolve: () => client.post.findUniqueOrThrow({ where: { id: 1 } }) as never,
    }),
    plainList: t.field({
      type: [Post],
      resolve: () =>
        client.post.findMany({ where: { id: { in: [1, 2] } }, orderBy: { id: 'asc' } }) as never,
    }),
    selectUser: t.field({
      type: SelectUser,
      resolve: () => client.user.findUniqueOrThrow({ where: { id: 1 } }),
    }),
    noSelectUser: t.field({
      type: NoSelectUser,
      resolve: () => client.user.findUniqueOrThrow({ where: { id: 1 } }),
    }),
    ifacePlanned: t.prismaField({
      type: IfacePost,
      resolve: (query) => client.post.findUniqueOrThrow({ ...query, where: { id: 1 } }) as never,
    }),
  }),
});

const schema = builder.toSchema();

describe('prisma runScopesOnType checks see the type include', () => {
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
    seen.post = [];
    seen.user = [];
    seen.impl = [];
  });

  it('is set only for types with a type-level selection, and only with ScopeAuthPlugin', () => {
    expect(schema.getType('Post')?.extensions?.pothosScopeAuthParent).toBeTypeOf('function');
    expect(schema.getType('NoSelectUser')?.extensions).not.toHaveProperty('pothosScopeAuthParent');

    const plain = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
      plugins: [PrismaPlugin],
      prisma: { client: db, dmmf: getDatamodel() },
      // Required by scope-auth's option types, which this file loads; unused without the plugin.
      scopeAuth: { authScopes: () => ({}) },
    });
    plain.prismaObject('Post', {
      include: { author: true },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    plain.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

    expect(plain.toSchema().getType('Post')?.extensions).not.toHaveProperty(
      'pothosScopeAuthParent',
    );
  });

  it('a planned row is checked as it is, without a reload', async () => {
    const result = await execute({ schema, document: gql`{ planned { id } }`, contextValue: {} });

    expect(result.errors).toBeUndefined();
    expect(seen.post).toEqual([authors.get(1)]);
    expect(queries).toBe(1);
  });

  it('returns a complete row synchronously', () => {
    const load = schema.getType('Post')?.extensions?.pothosScopeAuthParent as ScopeAuthParentLoader;
    const row = { id: 1, author: { id: 1 } };

    expect(load(row, {}, {} as GraphQLResolveInfo)).toBe(row);
  });

  it("a row without the type's include is reloaded before the type's authScopes run", async () => {
    const result = await execute({ schema, document: gql`{ plain { id } }`, contextValue: {} });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plain: { id: '1' } });
    expect(seen.post).toEqual([authors.get(1)]);
    // The root query and the type check's reload, which the field reuses.
    expect(queries).toBe(2);
  });

  it('the rows of a list are each reloaded once for the type check', async () => {
    const result = await execute({
      schema,
      document: gql`{ plainList { id } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.post).toEqual([authors.get(1), authors.get(2)]);
    // The root query, then a type check reload per row, which the fields reuse.
    expect(queries).toBe(3);
  });

  it("a row with the type's select columns is checked without a reload", async () => {
    const result = await execute({
      schema,
      document: gql`{ selectUser { id } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.user).toEqual([firstName]);
    // The root query and the field's reload, as without scope-auth.
    expect(queries).toBe(2);
  });

  it("a row planned through an interface is reloaded with the implementation's include", async () => {
    const result = await execute({
      schema,
      document: gql`{ ifacePlanned { ifaceId } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.impl).toEqual([authors.get(1)]);
  });
});
