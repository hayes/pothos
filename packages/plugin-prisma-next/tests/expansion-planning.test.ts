import { describe, expect, it, vi } from 'vitest';
import { PrismaAdapter } from '../src/utils/adapter';
import { detailOf } from './fixtures/errors';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

// A fragment on a non-model interface expands at every level of a document, so a relation is
// reached on the interface and on each implementation; the implementations take the interface's
// invocation. Every plan beneath it names its to-many slots by the position above it; those names
// must not make the walk beneath unshareable.
describe('planning fragments that expand at every level', () => {
  function cyclicSchema(implementations: number) {
    const builder = createBuilder();
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
          return { limit: 1 };
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
          collection: () => db.orm.User.where({ id: 'u-bob' }),
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
   * Runs `document`, bounding the planning work it costs: tree copies quadratic in its depth, by
   * `perLevel` for each of the invocations a level makes.
   */
  async function runBounded(
    implementations: number,
    depth: number,
    document: (depth: number, implementations: number) => string,
    perLevel = 20,
  ) {
    const copies = vi.spyOn(PrismaAdapter.prototype, 'toQuery');
    const { calls, schema } = cyclicSchema(implementations);
    copies.mockClear();

    const result = await run(schema, document(depth, implementations));
    const toQueryCalls = copies.mock.calls.length;

    copies.mockRestore();
    expect(result.errors).toBeUndefined();
    expect(toQueryCalls).toBeLessThan(perLevel * (implementations + 1) * depth * depth);
    expect(result.statements).toHaveLength(1);

    return calls;
  }

  // Planning beneath every invocation, or a slot per implementation, ran out of time or heap here.
  it.each([
    [1, 18, 9],
    [3, 12, 6],
    [3, 24, 12],
    [3, 28, 14],
    [3, 60, 30],
    [2, 36, 18],
    [6, 96, 48],
  ])('with %i implementations at depth %i it makes %i relation calls', async (implementations, depth, expected) => {
    const calls = await runBounded(implementations, depth, cyclicDocument);
    expect(calls.posts).toBe(expected);
  });

  // A walk per field node made 44,286 relation calls at depth 10 and ran out of heap at 12.
  it.each([
    [3, 10, 15],
    [3, 20, 30],
    [3, 40, 60],
    [2, 36, 36],
  ])('with a named fragment per level, %i implementations at depth %i make %i relation calls', async (implementations, depth, expected) => {
    // Each field node is invoked once, so the copies are bounded as for one node per level.
    const calls = await runBounded(implementations, depth, namedDocument);
    expect(calls.posts).toBe(expected);
  });
});

/**
 * The `combine()` branches the ORM had to rename. It cuts an alias to 63 bytes and renames the ones
 * that then collide one at a time, which costs time quadratic in their number. Slots named after
 * the fields above them collided this way beneath a deep document: 1,012 of 1,020 in the keyless
 * test below.
 */
function renamedBranches(sql: string) {
  return sql.match(/"[^"]*__combine__[^"]*_\d+"/g) ?? [];
}

// Aliases of a relation with different arguments each load into a `combine()` slot of their own,
// so a document that nests them doubles the slots of one statement at every level. Past a limit,
// a field loads its own data instead, and no statement grows with the document's nesting.
describe('aliases with different arguments nested at every level', () => {
  const depth = 8;

  function aliasSchema() {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        firstName: t.exposeString('firstName'),
        posts: t.relation('posts', {
          args: { limit: t.arg.int({ required: true }) },
          query: (args) => ({ limit: args.limit, orderBy: { id: 'asc' } }),
        }),
      }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ id: t.exposeID('id'), author: t.relation('author') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  function document() {
    let fragments = `fragment F${depth} on User { firstName }`;
    for (let level = depth - 1; level >= 0; level -= 1) {
      fragments += ` fragment F${level} on User {
        a: posts(limit: 1) { id author { ...F${level + 1} } }
        b: posts(limit: 2) { id author { ...F${level + 1} } }
      }`;
    }
    return `{ users { ...F0 } } ${fragments}`;
  }

  const postsBy: Record<string, string[]> = {
    Alice: ['p-draft1', 'p-hello'],
    Bob: ['p-bob-draft', 'p-bob1'],
  };

  function expected(firstName: string, level: number): object {
    if (level === depth) {
      return { firstName };
    }
    const posts = (limit: number) =>
      postsBy[firstName]!.slice(0, limit).map((id) => ({
        id,
        author: expected(firstName, level + 1),
      }));
    return { a: posts(1), b: posts(2) };
  }

  it('keeps every statement within the limit and loads the same data', async () => {
    const result = await run(aliasSchema(), document());
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([expected('Alice', 0), expected('Bob', 0)]);
    expect(result.statements.length).toBeGreaterThan(1);
    // Planned whole, the first statement would read the two tables more than 1000 times.
    for (const statement of result.statements) {
      expect(statement.sql.match(/FROM "(post|user)"/g)!.length).toBeLessThan(300);
      expect(renamedBranches(statement.sql)).toEqual([]);
    }
    // The result doubles at every level, so this runs well past the default timeout on a busy CI
    // runner. The statement checks above catch a planning regression.
  }, 30_000);
});

// A field the limit refuses reloads its parent, which a model without a key can't. A keyless level
// takes every field, so the document loads as it did before the limit.
describe('aliases nested beneath rows without a key', () => {
  const depth = 6;

  function keylessSchema() {
    const builder = createBuilder();
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        views: t.relation('views', {
          args: { limit: t.arg.int({ required: true }) },
          query: (args) => ({ limit: args.limit, orderBy: { viewer: 'asc' } }),
        }),
      }),
    });
    builder.prismaObject('PostView', {
      fields: (t) => ({ viewer: t.exposeString('viewer'), post: t.relation('post') }),
    });
    builder.queryType({
      fields: (t) => ({
        views: t.prismaField({
          type: ['PostView'],
          collection: () => db.orm.PostView.orderBy((view) => view.viewer.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  // Each alias of `post` plans alone, so their views merge on the keyless level above them.
  function document() {
    let fragments = `fragment V${depth} on PostView { viewer }`;
    for (let level = depth - 1; level >= 0; level -= 1) {
      fragments += ` fragment V${level} on PostView {
        first: post { a: views(limit: 1) { ...V${level + 1} } }
        second: post { b: views(limit: 2) { ...V${level + 1} } }
      }`;
    }
    return `{ views { ...V0 } } ${fragments}`;
  }

  const postOf: Record<string, string> = { Alice: 'p-bob1', Bob: 'p-hello', Carol: 'p-hello' };
  const viewersOf: Record<string, string[]> = { 'p-bob1': ['Alice'], 'p-hello': ['Bob', 'Carol'] };

  function expected(viewer: string, level: number): object {
    if (level === depth) {
      return { viewer };
    }
    const views = (limit: number) =>
      viewersOf[postOf[viewer]!]!.slice(0, limit).map((next) => expected(next, level + 1));
    return { first: { a: views(1) }, second: { b: views(2) } };
  }

  it('loads every field on a keyless level rather than reloading it', async () => {
    const result = await run(keylessSchema(), document());
    expect(result.errors).toBeUndefined();
    expect(result.data.views).toEqual(['Alice', 'Bob', 'Carol'].map((v) => expected(v, 0)));
    expect(result.statements).toHaveLength(1);
    expect(renamedBranches(result.statements[0]!.sql)).toEqual([]);
  });
});

// Each alias of a to-many relation with its own arguments is a table of the relation's join, which
// MySQL caps at 61 tables and SQLite at 64. Past the limit, a field reloads its parent.
describe('aliases with different arguments on one level', () => {
  it.each([
    [61, 1],
    [62, 2],
  ])('loads %i aliases in %i statements', async (count, statements) => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          args: { published: t.arg.int({ required: true }) },
          query: (args) => ({ where: { published: args.published } }),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const aliases = Array.from(
      { length: count },
      (_, i) => `p${i}: posts(published: ${i}) { id }`,
    ).join(' ');
    const result = await run(builder.toSchema(), `{ user { ${aliases} } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.user.p0).toEqual([{ id: 'p-draft1' }]);
    expect(result.data.user[`p${count - 1}`]).toEqual([]);
    expect(result.statements).toHaveLength(statements);
  });
});

// Every field the limit refuses reloads its parent, and the reloads batch, so a batch takes fields
// within the limit too.
describe('reload batches within the limit', () => {
  it('reloads 125 aliases past the limit in statements SQLite takes', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          args: { published: t.arg.int({ required: true }) },
          query: (args) => ({ where: { published: args.published } }),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const aliases = Array.from(
      { length: 125 },
      (_, i) => `p${i}: posts(published: ${i}) { id }`,
    ).join(' ');
    const result = await run(builder.toSchema(), `{ user { ${aliases} } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.user.p0).toEqual([{ id: 'p-draft1' }]);
    expect(result.data.user.p124).toEqual([]);
    // 61 aliases load with the user, and the other 64 reload in batches of 61 and 3.
    expect(result.statements).toHaveLength(3);
    for (const statement of result.statements) {
      expect(statement.sql.match(/FROM "post"/g)!.length).toBeLessThanOrEqual(61);
    }
  });
});

// An alias that repeats a to-one relation adds nothing the level doesn't hold, so the limit takes
// it even on a full level. (Aliases of a to-many relation with other arguments each load into a
// slot of their own.)
describe('aliases that repeat a to-one relation', () => {
  it('merges a repeated alias on a level at the limit', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('PostView', { fields: (t) => ({ viewer: t.exposeString('viewer') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({
        author: t.relation('author'),
        // Aliases with other arguments each load into a slot of their own.
        views: t.relation('views', {
          args: { take: t.arg.int({ required: true }) },
          query: (args) => ({ limit: args.take }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({
          type: 'Post',
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    // 60 slots of `views`, then `author`: the level loads exactly the limit.
    const views = Array.from(
      { length: 60 },
      (_, i) => `v${i}: views(take: ${100 + i}) { viewer }`,
    ).join(' ');
    const result = await run(
      builder.toSchema(),
      `{ post { ${views} x: author { id } y: author { id } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.post.y).toEqual({ id: 'u-alice' });
    expect(result.data.post.v59).toEqual([{ viewer: 'Bob' }, { viewer: 'Carol' }]);
    expect(result.statements).toHaveLength(1);
  });
});

// A reload merges the field before its type's selection, into a level that loads nothing yet, so a
// field the limit refuses beside a type-level relation fits its reload.
describe('a field past the limit beside a type-level relation', () => {
  it('loads the field by reloading its parent', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ posts: t.relation('posts') }) });
    builder.prismaObject('PostView', { fields: (t) => ({ viewer: t.exposeString('viewer') }) });
    builder.prismaObject('Post', {
      select: { comments: true },
      fields: (t) => ({
        id: t.exposeID('id'),
        author: t.relation('author'),
        views: t.relation('views', {
          args: { take: t.arg.int({ required: true }) },
          query: (args) => ({ limit: args.take }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({
          type: 'Post',
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    // `author` loads 1 + 1 + 61 beneath it (each `posts` level holds `comments`), so the outer
    // level, which holds `comments` too, refuses it.
    const views = Array.from(
      { length: 60 },
      (_, i) => `v${i}: views(take: ${100 + i}) { viewer }`,
    ).join(' ');
    const result = await run(
      builder.toSchema(),
      `{ post { id author { posts { id ${views} } } } }`,
    );
    expect(result.errors).toBeUndefined();
    const posts = result.data.post.author.posts as Record<string, unknown>[];
    expect(Object.fromEntries(posts.map((post) => [post.id, post.v59]))).toEqual({
      'p-draft1': [],
      'p-hello': [{ viewer: 'Bob' }, { viewer: 'Carol' }],
    });
    expect(result.statements).toHaveLength(2);
  });
});

it.each([
  40, 125,
])('budgets every reducer in %i aggregate fields, including reload batches', async (count) => {
  const builder = createBuilder();
  builder.prismaObject('User', {
    fields: (t) => ({
      stats: t.int({
        args: { n: t.arg.int({ required: true }) },
        select: (args) => ({
          posts: (posts) => ({
            c: posts.where({ published: args.n }).count(),
            d: posts.where({ published: args.n + 1 }).count(),
          }),
        }),
        resolve: (u) => u.c + u.d,
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({ user: t.prismaField({ type: 'User', query: { where: { id: 'u-alice' } } }) }),
  });
  const fields = Array.from({ length: count }, (_, i) => `f${i}: stats(n: ${i})`).join(' ');
  const result = await run(builder.toSchema(), `{ user { ${fields} } }`);
  expect(result.errors).toBeUndefined();
  expect(result.data.user).toEqual(
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`f${i}`, i === 0 ? 2 : i === 1 ? 1 : 0]),
    ),
  );
  expect(result.statements).toHaveLength(Math.ceil(count / 30));
});

it('rejects an aggregate callback with too many reducers before SQL', async () => {
  const builder = createBuilder();
  builder.prismaObject('User', {
    fields: (t) => ({
      stats: t.int({
        select: {
          posts: (posts) =>
            Object.fromEntries(Array.from({ length: 62 }, (_, i) => [`p${i}`, posts.count()])),
        },
        resolve: () => 0,
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({ user: t.prismaField({ type: 'User', query: { where: { id: 'u-alice' } } }) }),
  });
  const result = await run(builder.toSchema(), '{ user { stats } }');
  expect(result.errors).toHaveLength(1);
  expect(result.errors![0]!.message).toBe('Unexpected error.');
  expect(detailOf(result.errors![0])).toContain('loads 62 aggregate reducers at one level');
  expect(result.statements).toHaveLength(0);
});

it('budgets the reducers of every aggregate relation in one field together', async () => {
  const builder = createBuilder();
  builder.prismaObject('User', {
    fields: (t) => ({
      stats: t.int({
        select: {
          posts: (posts) =>
            Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`p${i}`, posts.count()])),
          comments: (comments) =>
            Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`c${i}`, comments.count()])),
        },
        resolve: () => 0,
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({ user: t.prismaField({ type: 'User', query: { where: { id: 'u-alice' } } }) }),
  });
  const result = await run(builder.toSchema(), '{ user { stats } }');
  expect(result.errors).toHaveLength(1);
  expect(result.errors![0]!.message).toBe('Unexpected error.');
  expect(detailOf(result.errors![0])).toContain('loads 62 aggregate reducers at one level');
  expect(result.statements).toHaveLength(0);
});
