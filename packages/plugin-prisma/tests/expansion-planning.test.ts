import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prismaAdapter } from '../src/util/adapter';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Ported from plugin-prisma-next's `tests/expansion-planning.test.ts`.

afterEach(() => {
  queries.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// A fragment on a non-model interface expands at every level of a document, so a relation is
// reached on the interface and on each implementation; the implementations take the interface's
// invocation. Every plan beneath it names its to-many slots by the position above it; those names
// must not make the walk beneath unshareable.
describe('planning fragments that expand at every level', () => {
  function cyclicSchema(implementations: number) {
    const builder = new SchemaBuilder<{
      PrismaTypes: PrismaTypesFromClient<typeof prisma>;
    }>({
      plugins: [PrismaPlugin],
      prisma: {
        client: () => prisma,
        dmmf: getDatamodel(),
      },
    });
    const calls = { posts: 0 };
    const Linked = builder.interfaceRef<object>('Linked').implement({
      fields: (t) => ({ linked: t.string({ resolve: () => 'linked' }) }),
    });
    const User = builder.prismaInterface('User', {
      variant: 'CyclicUser',
      resolveType: () => 'CyclicUser1',
      fields: (t) => ({ userId: t.exposeID('id') }),
    });
    const Post = builder.prismaInterface('Post', {
      variant: 'CyclicPost',
      resolveType: () => 'CyclicPost1',
      fields: (t) => ({ postId: t.exposeID('id') }),
    });

    builder.prismaInterfaceField(User, 'posts', (t) =>
      t.relation('posts', {
        type: Post,
        query: () => {
          calls.posts += 1;

          // One row per level, so the response doesn't double at every level.
          return { take: 1 };
        },
      }),
    );
    builder.prismaInterfaceField(Post, 'author', (t) => t.relation('author', { type: User }));

    for (let n = 1; n <= implementations; n += 1) {
      builder.prismaObject('User', { variant: `CyclicUser${n}`, interfaces: [User, Linked] });
      builder.prismaObject('Post', { variant: `CyclicPost${n}`, interfaces: [Post, Linked] });
    }

    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: User,
          nullable: true,
          resolve: (query) => prisma.user.findUnique({ ...query, where: { id: 1 } }),
        }),
      }),
    });

    return { calls, schema: builder.toSchema() };
  }

  function cyclicDocument(depth: number) {
    let selection = '... on Linked { linked }';

    for (let level = depth; level >= 1; level -= 1) {
      selection =
        level % 2 === 1
          ? `... on Linked { ... on CyclicUser { posts { ${selection} } } }`
          : `... on Linked { ... on CyclicPost { author { ${selection} } } }`;
    }

    return `{ user { ${selection} } }`;
  }

  // One named fragment per level, selecting the relation beneath each implementation: every level
  // holds `implementations` field nodes with the same selection set, so the document is linear in
  // its depth while its paths multiply at every level.
  function namedDocument(depth: number, implementations: number) {
    const fragments: string[] = [];

    for (let level = 1; level <= depth; level += 1) {
      const next = level === depth ? '... on Linked { linked }' : `...L${level + 1}`;
      const selections = Array.from({ length: implementations }, (_, i) =>
        level % 2 === 1
          ? `... on CyclicUser${i + 1} { posts { ${next} } }`
          : `... on CyclicPost${i + 1} { author { ${next} } }`,
      );

      fragments.push(`fragment L${level} on Linked { ${selections.join(' ')} }`);
    }

    return `{ user { ...L1 } } ${fragments.join(' ')}`;
  }

  /**
   * Runs `document`, bounding the planning work it costs by twice the tree copies it makes now:
   * quadratic in its depth, and for a named document linear in the field nodes a level holds.
   */
  async function runBounded(
    implementations: number,
    depth: number,
    document: (depth: number, implementations: number) => string,
    copiesNow: (depth: number, implementations: number) => number,
  ) {
    const copies = vi.spyOn(prismaAdapter, 'toQuery');
    const { calls, schema } = cyclicSchema(implementations);
    copies.mockClear();
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql(document(depth, implementations)),
      contextValue: {},
    });
    const toQueryCalls = copies.mock.calls.length;

    copies.mockRestore();
    expect(result.errors).toBeUndefined();
    expect(toQueryCalls).toBeLessThanOrEqual(2 * copiesNow(depth, implementations));
    expect(queries).toHaveLength(1);

    return calls;
  }

  // A copy per level for each level above it, however many implementations take the invocation.
  const cyclicCopies = (depth: number) => ((depth + 1) * (depth + 2)) / 2;

  // Planning beneath every invocation, or a slot per implementation, ran out of time or heap here.
  // prisma-next also runs 6 implementations at depth 96, which plans the same here but nests deeper
  // than Prisma's query engine accepts.
  it.each([
    [1, 18, 9],
    [3, 12, 6],
    [3, 24, 12],
    [3, 28, 14],
    [3, 60, 30],
    [2, 36, 18],
    [6, 60, 30],
  ])('with %i implementations at depth %i it makes %i relation calls', async (implementations, depth, expected) => {
    const calls = await runBounded(implementations, depth, cyclicDocument, cyclicCopies);
    expect(calls.posts).toBe(expected);
  });

  // Each field node is invoked once, so the copies are as above for each field node a level holds.
  const namedCopies = (depth: number, implementations: number) =>
    ((depth + 1) * (implementations * depth + 2)) / 2;

  // A walk per field node made 44,286 relation calls at depth 10 and ran out of heap at 12.
  it.each([
    [3, 10, 15],
    [3, 20, 30],
    [3, 40, 60],
    [2, 36, 36],
  ])('with a named fragment per level, %i implementations at depth %i make %i relation calls', async (implementations, depth, expected) => {
    const calls = await runBounded(implementations, depth, namedDocument, namedCopies);
    expect(calls.posts).toBe(expected);
  });
});

describe('many aliases of one relation with different arguments', () => {
  function aliasSchema() {
    const builder = new SchemaBuilder<{
      PrismaTypes: PrismaTypesFromClient<typeof prisma>;
    }>({
      plugins: [PrismaPlugin],
      prisma: {
        client: () => prisma,
        dmmf: getDatamodel(),
      },
    });

    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relation('posts', {
          args: { limit: t.arg.int({ required: true }) },
          query: (args) => ({ take: args.limit, orderBy: { id: 'asc' } }),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          nullable: true,
          resolve: (query) => prisma.user.findUnique({ ...query, where: { id: 1 } }),
        }),
      }),
    });

    return builder.toSchema();
  }

  async function copiesFor(count: number) {
    const schema = aliasSchema();
    const copies = vi.spyOn(prismaAdapter, 'toQuery');
    copies.mockClear();
    const aliases = Array.from(
      { length: count },
      (_, i) => `p${i}: posts(limit: ${i + 1}) { id }`,
    ).join(' ');
    const result = await execute({
      schema,
      document: gql(`{ user { id ${aliases} } }`),
      contextValue: {},
    });
    const calls = copies.mock.calls.length;

    copies.mockRestore();
    expect(result.errors).toBeUndefined();

    return calls;
  }

  // Each alias loads on its own. Twice the aliases take twice the copies (4 per alias); work per
  // alias that grows with the aliases before it takes four times as many.
  it('plans in work linear in the aliases', async () => {
    const small = await copiesFor(100);
    const large = await copiesFor(200);

    expect(large).toBeLessThan(small * 3);
  });
});
