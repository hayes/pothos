import { describe, expect, it } from 'vitest';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

// `I` is implemented by A, which inherits its fields, and B, which overrides them.
describe("an implementation's override of an interface field", () => {
  function schema() {
    const builder = createBuilder();
    const I = builder.prismaInterface('User', {
      variant: 'I',
      resolveType: (row) => (row.id === 'u-bob' ? 'B' : 'A'),
      fields: (t) => ({
        id: t.exposeID('id'),
        pub: t.relation('posts', { query: { where: { published: 1 } } }),
        narrowed: t.relation('posts'),
        widened: t.relation('posts', { query: { where: { published: 1 } } }),
        count: t.relationCount('posts'),
        selected: t.stringList({
          select: { posts: { where: { published: 1 } } },
          resolve: (user) => user.posts.map((post) => post.id),
        }),
        computed: t.stringList({
          select: () => ({ posts: { where: { published: 1 } } }),
          resolve: (user) => user.posts.map((post) => post.id),
        }),
      }),
    });
    const P = builder.prismaInterface('Post', {
      variant: 'P',
      resolveType: (row) => (row.id === 'p-bob1' ? 'PB' : 'PA'),
      fields: (t) => ({
        id: t.exposeID('id'),
        // Filtered down to nobody, so an override's own author is visible.
        writer: t.relation('author', { nullable: true, query: { where: { id: 'nobody' } } }),
      }),
    });
    builder.prismaObject('Post', { variant: 'PA', interfaces: [P] });
    builder.prismaObject('Post', {
      variant: 'PB',
      interfaces: [P],
      fields: (t) => ({ writer: t.relation('author', { nullable: true }) }),
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    // A non-model interface both implementations share, so a fragment on it expands.
    const Linked = builder.interfaceRef<object>('Linked').implement({
      fields: (t) => ({ linked: t.string({ resolve: () => 'linked' }) }),
    });
    builder.prismaObject('User', { variant: 'A', interfaces: [I, Linked] });
    builder.prismaObject('User', {
      variant: 'B',
      interfaces: [I, Linked],
      fields: (t) => ({
        pub: t.relation('posts', { query: { where: { published: 0 } } }),
        narrowed: t.relation('posts', { query: { where: { published: 0 } } }),
        widened: t.relation('posts'),
        count: t.relationCount('posts', { where: { published: 0 } }),
        selected: t.stringList({
          select: { posts: { where: { published: 0 } } },
          resolve: (user) => user.posts.map((post) => post.id),
        }),
        computed: t.stringList({
          select: () => ({ posts: { where: { published: 0 } } }),
          resolve: (user) => user.posts.map((post) => post.id),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [I],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        posts: t.prismaField({
          type: [P],
          resolve: () => db.orm.Post.where({ published: 1 }).orderBy((post) => post.id.asc()),
        }),
      }),
    });

    return builder.toSchema();
  }

  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

  it.each([
    ['a filter replacing the interface filter', 'pub', ['p-hello'], ['p-bob-draft']],
    [
      'a filter over an unfiltered interface field',
      'narrowed',
      ['p-draft1', 'p-hello'],
      ['p-bob-draft'],
    ],
    [
      'no filter over a filtered interface field',
      'widened',
      ['p-hello'],
      ['p-bob-draft', 'p-bob1'],
    ],
  ])('applies %s', async (_name, field, alice, bob) => {
    const result = await run(schema(), `{ users { id ${field} { id } } }`);

    expect(result.errors).toBeUndefined();
    expect(ids(result.data.users[0][field]).sort()).toEqual(alice);
    expect(ids(result.data.users[1][field]).sort()).toEqual(bob);
  });

  it.each([
    'pub',
    'selected',
    'computed',
  ])('applies an overriding %s beneath a fragment that expands to the implementations', async (field) => {
    const selection = field === 'pub' ? `${field} { id }` : field;
    const result = await run(
      schema(),
      `{ users { id ... on Linked { ... on I { ${selection} } } } }`,
    );
    const values = (user: Record<string, unknown>) =>
      field === 'pub' ? ids(user[field] as { id: string }[]).sort() : user[field];

    expect(result.errors).toBeUndefined();
    expect(result.data.users.map(values)).toEqual([['p-hello'], ['p-bob-draft']]);
  });

  it('applies an overriding relation count', async () => {
    const result = await run(schema(), '{ users { id count } }');

    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', count: 2 },
      { id: 'u-bob', count: 1 },
    ]);
  });

  it.each(['selected', 'computed'])('applies an overriding %s select', async (field) => {
    const result = await run(schema(), `{ users { id ${field} } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', [field]: ['p-hello'] },
      { id: 'u-bob', [field]: ['p-bob-draft'] },
    ]);
  });

  it('applies a to-one override', async () => {
    const result = await run(schema(), '{ posts { id writer { id } } }');

    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      { id: 'p-bob1', writer: { id: 'u-bob' } },
      { id: 'p-hello', writer: null },
    ]);
  });

  it('plans an inheriting implementation and a reload only for the overriding one', async () => {
    const result = await run(schema(), '{ users { id pub { id } } }');

    expect(result.statements).toHaveLength(2);
  });

  it('loads an override planned through a fragment in one statement', async () => {
    const result = await run(
      schema(),
      '{ users { id ... on B { pub { id } } ... on A { pub { id } } } }',
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', pub: [{ id: 'p-hello' }] },
      { id: 'u-bob', pub: [{ id: 'p-bob-draft' }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });
});
