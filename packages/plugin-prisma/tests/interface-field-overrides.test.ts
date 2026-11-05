import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { parse } from 'graphql';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// An implementation that redefines an interface field with other relation arguments, selected
// beneath the interface: the interface's plan must not answer for it.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { typeName: string };
}>({
  plugins: [PrismaPlugin],
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

const Linked = builder.interfaceRef<object>('Linked').implement({
  fields: (t) => ({ linked: t.string({ resolve: () => 'linked' }) }),
});

const Post = builder.prismaObject('Post', {
  name: 'OverridePost',
  fields: (t) => ({ id: t.exposeID('id') }),
});

const OverrideUser = builder.prismaInterface('User', {
  variant: 'OverrideUser',
  select: { id: true },
  resolveType: (_user, ctx) => ctx.typeName,
  fields: (t) => ({
    posts: t.relation('posts', { type: Post, query: { take: 3, orderBy: { id: 'asc' } } }),
    // The same relation through a static field select.
    recent: t.field({
      type: [Post],
      select: { posts: { take: 3, orderBy: { id: 'asc' } } },
      resolve: (user) => user.posts,
    }),
  }),
});

builder.prismaObject('User', {
  variant: 'InheritingUser',
  interfaces: [OverrideUser, Linked],
  select: { id: true },
});
builder.prismaObject('User', {
  variant: 'OverridingUser',
  interfaces: [OverrideUser, Linked],
  select: { id: true },
  fields: (t) => ({
    posts: t.relation('posts', { type: Post, query: { take: 1, orderBy: { id: 'desc' } } }),
    recent: t.field({
      type: [Post],
      select: { posts: { take: 1, orderBy: { id: 'desc' } } },
      resolve: (user) => user.posts,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: OverrideUser,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('an implementation that overrides an interface field', () => {
  const ids = async (take: number, order: 'asc' | 'desc') =>
    (
      await prisma.post.findMany({
        where: { authorId: 1 },
        take,
        orderBy: { id: order },
        select: { id: true },
      })
    ).map((post) => ({ id: String(post.id) }));

  afterEach(() => {
    queries.length = 0;
  });

  it.each(
    ['posts', 'recent'].flatMap((field) => [
      [field, 'plainly', `{ user { ${field} { id } } }`],
      [
        field,
        'beneath an expansion',
        `{ user { ... on Linked { ... on OverrideUser { ${field} { id } } } } }`,
      ],
    ]),
  )('loads the override of %s with its own arguments when selected %s', async (field, _, document) => {
    const overriding = await ids(1, 'desc');
    const inherited = await ids(3, 'asc');

    queries.length = 0;

    const result = await execute({
      schema,
      document: parse(document),
      contextValue: { typeName: 'OverridingUser' },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { [field]: overriding } });
    // The parent query loads the interface's selection, which the override does not read.
    expect(queries).toHaveLength(2);

    queries.length = 0;

    const inheriting = await execute({
      schema,
      document: parse(document),
      contextValue: { typeName: 'InheritingUser' },
    });

    expect(inheriting.errors).toBeUndefined();
    expect(inheriting.data).toEqual({ user: { [field]: inherited } });
    expect(queries).toHaveLength(1);
  });
});
