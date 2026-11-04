import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  relay: {},
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const page = { take: 3, orderBy: { id: 'asc' } } as const;

const Post = builder.prismaObject('Post', {
  name: 'OverriddenPost',
  fields: (t) => ({ id: t.exposeID('id') }),
});
// Shared, so the override's connection has the interface's type.
const PostConnection = builder.connectionObject({ type: Post, name: 'OverriddenPostConnection' });

// `I` is implemented by A, which inherits its fields, and B, which overrides them.
const I = builder.prismaInterface('User', {
  name: 'OverriddenUser',
  resolveType: (user) => (user.id === 2 ? 'OverridingUser' : 'InheritingUser'),
  fields: (t) => ({
    id: t.exposeID('id'),
    pub: t.relation('posts', { query: { ...page, where: { published: true } } }),
    narrowed: t.relation('posts', { query: page }),
    widened: t.relation('posts', { query: { ...page, where: { published: true } } }),
    count: t.relationCount('posts', { where: { published: true } }),
    connection: t.relatedConnection(
      'posts',
      {
        cursor: 'id',
        query: { where: { published: true } },
      },
      PostConnection,
    ),
    selected: t.idList({
      select: { posts: { ...page, where: { published: true } } },
      resolve: (user) => user.posts.map((post) => post.id),
    }),
    computed: t.idList({
      select: () => ({ posts: { ...page, where: { published: true } } }),
      resolve: (user) => user.posts.map((post) => post.id),
    }),
  }),
});

builder.prismaObject('User', { variant: 'InheritingUser', interfaces: [I] });
builder.prismaObject('User', {
  variant: 'OverridingUser',
  interfaces: [I],
  fields: (t) => ({
    pub: t.relation('posts', { query: { ...page, where: { published: false } } }),
    narrowed: t.relation('posts', { query: { ...page, where: { published: false } } }),
    widened: t.relation('posts', { query: page }),
    count: t.relationCount('posts', { where: { published: false } }),
    connection: t.relatedConnection(
      'posts',
      {
        cursor: 'id',
        query: { where: { published: false } },
      },
      PostConnection,
    ),
    selected: t.idList({
      select: { posts: { ...page, where: { published: false } } },
      resolve: (user) => user.posts.map((post) => post.id),
    }),
    computed: t.idList({
      select: () => ({ posts: { ...page, where: { published: false } } }),
      resolve: (user) => user.posts.map((post) => post.id),
    }),
  }),
});

// `Middle` inherits `pub` from `I` without overriding it, and `Leaf` inherits it from `Middle`.
const Middle = builder.prismaInterface('User', {
  variant: 'Middle',
  interfaces: [I],
  resolveType: () => 'Leaf',
});
builder.prismaObject('User', { variant: 'Leaf', interfaces: [I, Middle] });

builder.queryType({
  fields: (t) => ({
    middles: t.prismaField({
      type: [Middle],
      resolve: (query) => prisma.user.findMany({ ...query, where: { id: 1 } }),
    }),
    users: t.prismaField({
      type: [I],
      resolve: (query) =>
        prisma.user.findMany({ ...query, where: { id: { in: [1, 2] } }, orderBy: { id: 'asc' } }),
    }),
  }),
});

const schema = builder.toSchema();

async function run(source: string) {
  queries.length = 0;
  const result = (await execute({ schema, document: gql(source), contextValue: {} })) as {
    data: Record<string, Record<string, unknown>[]>;
    errors?: unknown;
  };

  return { ...result, queries: queries.length };
}

async function postIds(authorId: number, published?: boolean, take: number | null = 3) {
  const posts = await prisma.post.findMany({
    where: { authorId, published },
    take: take ?? undefined,
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  return posts.map((post) => String(post.id));
}

const ids = (rows: unknown) => (rows as { id: string }[]).map((row) => row.id);

describe("an implementation's override of an interface field", () => {
  it.each([
    ['a filter replacing the interface filter', 'pub', true, false],
    ['a filter over an unfiltered interface field', 'narrowed', undefined, false],
    ['no filter over a filtered interface field', 'widened', true, undefined],
  ] as const)('applies %s', async (_name, field, inherited, overridden) => {
    const result = await run(`{ users { id ${field} { id } } }`);

    expect(result.errors).toBeUndefined();
    expect(ids(result.data.users[0][field])).toEqual(await postIds(1, inherited));
    expect(ids(result.data.users[1][field])).toEqual(await postIds(2, overridden));
    // One query for the users and the inheriting implementation, one reload for the override.
    expect(result.queries).toBe(2);
  });

  it('applies an overriding relation count', async () => {
    const result = await run('{ users { id count } }');

    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: '1', count: (await postIds(1, true, null)).length },
      { id: '2', count: (await postIds(2, false, null)).length },
    ]);
    expect(result.queries).toBe(2);
  });

  it('applies an overriding related connection', async () => {
    const result = await run('{ users { id connection(first: 2) { edges { node { id } } } } }');

    expect(result.errors).toBeUndefined();
    const nodes = (index: number) =>
      (result.data.users[index].connection as { edges: { node: { id: string } }[] }).edges.map(
        (edge) => edge.node.id,
      );
    expect(nodes(0)).toEqual(await postIds(1, true, 2));
    expect(nodes(1)).toEqual(await postIds(2, false, 2));
    expect(result.queries).toBe(2);
  });

  it.each(['selected', 'computed'])('applies an overriding %s select', async (field) => {
    const result = await run(`{ users { id ${field} } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: '1', [field]: await postIds(1, true) },
      { id: '2', [field]: await postIds(2, false) },
    ]);
    expect(result.queries).toBe(2);
  });

  it('resolves a field inherited through an intermediate interface from the planned query', async () => {
    const result = await run('{ middles { id pub { id } } }');

    expect(result.errors).toBeUndefined();
    expect(ids(result.data.middles[0].pub)).toEqual(await postIds(1, true));
    expect(result.queries).toBe(1);
  });

  it('resolves an override and an inherited field selected through fragments', async () => {
    const result = await run(
      '{ users { id ... on OverridingUser { pub { id } } ... on InheritingUser { pub { id } } } }',
    );

    expect(result.errors).toBeUndefined();
    expect(ids(result.data.users[0].pub)).toEqual(await postIds(1, true));
    expect(ids(result.data.users[1].pub)).toEqual(await postIds(2, false));
    // The two fragments select the relation with conflicting filters, so one of them reloads.
    expect(result.queries).toBe(2);
  });
});
