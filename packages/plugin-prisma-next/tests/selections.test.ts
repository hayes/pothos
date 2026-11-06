import { describe, expect, it } from 'vitest';
import { buildExampleSchema } from './example/schema';
import { detailOf } from './fixtures/errors';
import {
  columnsOf,
  createBuilder,
  deferSchema,
  postSubqueries,
  run,
  runIncremental,
  type SampleOptions,
  useSampleDb,
} from './fixtures/helpers';

const db = useSampleDb();
const example = (source: string, variables?: Record<string, unknown>) =>
  run(buildExampleSchema(db), source, { variables });

describe('directives and fragments', () => {
  it('drops fields excluded by @skip and @include, including through variables', async () => {
    const skipped = await example(
      'query ($no: Boolean!) { users { firstName lastName @skip(if: true) email @include(if: $no) } }',
      { no: false },
    );
    expect(skipped.data.users[0]).toEqual({ firstName: 'Alice' });
    expect(columnsOf(skipped.statements[0].sql, 'user')).toEqual(new Set(['firstName', 'id']));

    const kept = await example(
      'query ($yes: Boolean!) { users { firstName @skip(if: false) email @include(if: $yes) } }',
      { yes: true },
    );
    expect(columnsOf(kept.statements[0].sql, 'user')).toEqual(
      new Set(['firstName', 'email', 'id']),
    );
  });

  it('drops inline fragments and fragment spreads excluded by directives', async () => {
    const result = await example(
      `query ($skip: Boolean!) {
        users { firstName ... on User @skip(if: $skip) { email } ...Last @include(if: false) }
      }
      fragment Last on User { lastName }`,
      { skip: true },
    );
    expect(result.data.users[0]).toEqual({ firstName: 'Alice' });
    expect(columnsOf(result.statements[0].sql, 'user')).toEqual(new Set(['firstName', 'id']));
  });

  it('unions one relation selected through several fragments into one subquery', async () => {
    const result = await example(`
      { users { ...A ...B ... { email } } }
      fragment A on User { posts { title } }
      fragment B on User { ...C }
      fragment C on User { firstName posts { isPublished } }
    `);
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      email: 'alice@example.com',
      firstName: 'Alice',
      posts: [
        { title: 'Hello, Pothos', isPublished: 1 },
        { title: 'Draft #1', isPublished: 0 },
      ],
    });
    const [{ sql }] = result.statements;
    expect(postSubqueries(sql)).toBe(1);
    expect(columnsOf(sql, 'post')).toEqual(new Set(['title', 'published', 'authorId', 'id']));
  });

  it('plans deferred fragments into the initial query when skipDeferredFragments is false', async () => {
    const result = await runIncremental(
      deferSchema(createExampleBuilder({ skipDeferredFragments: false })),
      '{ users { id ... @defer { firstName posts { title } } } }',
    );
    expect(result.initial.errors).toBeUndefined();
    expect(result.initial.data).toEqual({ users: [{ id: 'u-alice' }, { id: 'u-bob' }] });
    expect(result.initialStatements).toBe(1);
    expect(result.statements).toHaveLength(1);
    expect(columnsOf(result.statements[0].sql, 'user')).toEqual(new Set(['id', 'firstName']));
    expect(result.patches).toEqual([
      { firstName: 'Alice', posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }] },
      { firstName: 'Bob', posts: [{ title: 'Bob writes' }, { title: 'Bob draft' }] },
    ]);
  });
});

function createExampleBuilder(options: SampleOptions = {}) {
  const builder = createBuilder(options);
  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      posts: t.relation('posts'),
    }),
  });
  builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
  builder.queryType({
    fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
  });
  return builder;
}

describe('field select forms', () => {
  function schema() {
    const builder = createBuilder();
    builder.prismaObject('Post', {
      fields: (t) => ({ id: t.exposeID('id'), title: t.exposeString('title') }),
    });
    builder.prismaObject('Comment', { fields: (t) => ({ body: t.exposeString('body') }) });
    builder.prismaObject('User', {
      select: { comments: true },
      fields: (t) => ({
        posts: t.relation('posts'),
        fromArray: t.string({ select: ['firstName'], resolve: (user) => user.firstName }),
        fromObject: t.string({
          select: { firstName: true, lastName: true, posts: true },
          resolve: (user) => `${user.firstName} ${user.lastName} (${user.posts.length})`,
        }),
        firstPostTitle: t.string({
          nullable: true,
          select: { posts: true },
          resolve: (user) => user.posts[0]?.title ?? null,
        }),
        latestTitle: t.string({
          nullable: true,
          select: {
            posts: { where: { published: 1 }, orderBy: { createdAt: 'desc' }, limit: 1 },
          },
          resolve: (user) => user.posts[0]?.title ?? null,
        }),
        secondTitle: t.string({
          nullable: true,
          select: { posts: { orderBy: { id: 'asc' }, offset: 1, limit: 1 } },
          resolve: (user) => user.posts[0]?.title ?? null,
        }),
        published: t.string({
          select: {
            publishedRows: { posts: (sub) => sub.where({ published: 1 }) },
            publishedCount: { posts: (sub) => sub.where({ published: 1 }).count() },
          },
          resolve: (user) =>
            `${user.publishedCount}: ${user.publishedRows.map((post) => post.title).join(', ')}`,
        }),
        refined: t.string({
          select: { posts: (posts) => posts.where({ published: 0 }) },
          resolve: (user) => user.posts.map((post) => post.title).join(', '),
        }),
        commentCount: t.int({ resolve: (user) => user.comments.length }),
        greeting: t.string({
          args: { formal: t.arg.boolean({ required: true }) },
          select: (args) => (args.formal ? { lastName: true } : { firstName: true }),
          resolve: (user, args) =>
            args.formal
              ? `Dear ${(user as { lastName?: string }).lastName}`
              : `Hi ${(user as { firstName?: string }).firstName}`,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('loads every select form for the resolver in one statement', async () => {
    const result = await run(
      schema(),
      `{ users {
        fromArray fromObject firstPostTitle latestTitle secondTitle published refined
        commentCount posts { title } informal: greeting(formal: false) formal: greeting(formal: true)
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        fromArray: 'Alice',
        fromObject: 'Alice Andrews (2)',
        firstPostTitle: 'Hello, Pothos',
        latestTitle: 'Hello, Pothos',
        secondTitle: 'Hello, Pothos',
        published: '1: Hello, Pothos',
        refined: 'Draft #1',
        commentCount: 1,
        posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
        informal: 'Hi Alice',
        formal: 'Dear Andrews',
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('rejects exposing a computed value when the schema is built', () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      select: { postCount: { posts: (sub) => sub.count() } },
      fields: () => ({}),
    });
    builder.objectField(User, 'postCount', (t) => t.exposeInt('postCount'));
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    expect(() => builder.toSchema()).toThrow(
      /'User\.postCount' exposes 'postCount', which is not a column on model User/,
    );
  });

  it('loads a relation selected with an empty object, as with true', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        postCount: t.int({
          select: { posts: {} },
          resolve: (user) => user.posts.length,
        }),
      }),
    });
    const UserWithPosts = builder.prismaObject('User', {
      variant: 'UserWithPosts',
      select: { posts: {} },
      fields: (t) => ({ postCount: t.int({ resolve: (user) => user.posts.length }) }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        withPosts: t.prismaField({
          type: [UserWithPosts],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { postCount } withPosts { postCount } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([{ postCount: 2 }, { postCount: 2 }]);
    expect(result.data.withPosts).toEqual([{ postCount: 2 }, { postCount: 2 }]);
  });

  it('selects nothing for a null entry of what a select function returns', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        name: t.string({
          args: { withEmail: t.arg.boolean() },
          select: (args) => ({ firstName: true, email: args.withEmail ? true : null }),
          resolve: (user) => user.firstName,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    const result = await run(builder.toSchema(), '{ users { name(withEmail: false) } }');
    expect(result.errors).toBeUndefined();
    expect(columnsOf(result.statements[0].sql, 'user')).toEqual(new Set(['firstName', 'id']));
  });
});

describe('async selects', () => {
  const titles = [{ asyncTitle: 'Hello, Pothos' }, { asyncTitle: 'Draft #1' }];
  function schema() {
    const builder = createBuilder();
    const later = <T>(value: T) => Promise.resolve().then(() => value);
    const Admin = builder.prismaObject('User', {
      variant: 'Admin',
      select: { total: { posts: (sub) => sub.count() } },
      fields: (t) => ({
        total: t.int({ resolve: (user) => user.total }),
        asyncLastName: t.string({
          select: () => later({ lastName: true } as const),
          resolve: (user) => (user as { lastName?: string }).lastName ?? 'missing',
        }),
        posts: t.relation('posts'),
      }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({
        asyncTitle: t.string({
          select: () => later({ title: true } as const),
          resolve: (post) => (post as { title?: string }).title ?? 'missing',
        }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts'),
        drafts: t.relation('posts', { query: { where: { published: 0 } } }),
        admin: t.variant(Admin),
        postsConnection: t.relatedConnection('posts', { totalCount: true }),
        pageCount: t.int({
          select: (() =>
            later({
              pageCount: {
                posts: (sub: { limit(n: number): { count(): unknown } }) => sub.limit(1).count(),
              },
            })) as never,
          resolve: (user) => (user as { pageCount?: number }).pageCount ?? -1,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  it.each([
    ['a relation', '{ users { posts { asyncTitle } } }', { posts: [titles[0], titles[1]] }],
    ['a refined relation', '{ users { drafts { asyncTitle } } }', { drafts: [titles[1]] }],
    [
      'a variant',
      '{ users { admin { total asyncLastName posts { asyncTitle } } } }',
      { admin: { total: 2, asyncLastName: 'Andrews', posts: [titles[0], titles[1]] } },
    ],
    [
      'a connection',
      '{ users { postsConnection { totalCount nodes { asyncTitle } } } }',
      { postsConnection: { totalCount: 2, nodes: [titles[1], titles[0]] } },
    ],
    ['the field itself', '{ users { pageCount } }', { pageCount: 1 }],
  ])('awaits async selects beneath %s before running one statement', async (_name, source, user) => {
    const result = await run(schema(), source);
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([user]);
    expect(result.statements).toHaveLength(1);
  });
});

describe('parents the plugin loads', () => {
  it('loads the columns a type declares for a totalCount callback', async () => {
    const seen: string[] = [];
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      select: ['email'],
      fields: (t) => ({
        firstName: t.exposeString('firstName'),
        posts: t.relatedConnection('posts', {
          totalCount: (user) => {
            seen.push(user.email);
            return 7;
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { posts { totalCount } } }');
    expect(result.data).toEqual({ users: [{ posts: { totalCount: 7 } }] });
    expect(seen).toEqual(['alice@example.com']);
  });

  it.each([
    ['an array', ['firstName'] as const],
    ['an object', { firstName: true } as const],
  ])('forces a variant select given as %s into the row for isNull, whatever the query selects', async (_name, select) => {
    const builder = createBuilder();
    const Admin = builder.prismaObject('User', {
      variant: 'Admin',
      fields: (t) => ({ lastName: t.exposeString('lastName') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        admin: t.variant(Admin, {
          select,
          isNull: (user) => user.firstName !== 'Alice',
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    const result = await run(builder.toSchema(), '{ users { id admin { lastName } } }');
    expect(result.data.users).toEqual([
      { id: 'u-alice', admin: { lastName: 'Andrews' } },
      { id: 'u-bob', admin: null },
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

describe('function-form select with object branches', () => {
  it('loads what the branch for the arguments selects', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        name: t.string({
          args: { first: t.arg.boolean() },
          select: (args) => (args.first ? { firstName: true } : { lastName: true }),
          resolve: (user) => user.firstName ?? user.lastName ?? '',
        }),
        contact: t.string({
          args: { first: t.arg.boolean() },
          select: (args) => ({ email: true, ...(args.first ? { firstName: true } : {}) }),
          resolve: (user) => `${user.firstName ?? 'anon'} ${user.email}`,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const schema = builder.toSchema();
    const read = async (selection: string) => {
      const result = await run(schema, `{ user { ${selection} } }`);
      expect(result.errors).toBeUndefined();
      return Object.values(result.data.user)[0];
    };
    expect(await read('name(first: true)')).toBe('Alice');
    expect(await read('name(first: false)')).toBe('Andrews');
    expect(await read('contact(first: true)')).toBe('Alice alice@example.com');
    expect(await read('contact')).toBe('anon alice@example.com');
  });
});

describe('root-style fields on a prisma type', () => {
  it('loads the select of a prismaField and a prismaConnection for their resolvers', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        latest: t.prismaField({
          type: 'Post',
          select: ['firstName'],
          resolve: (user) => db.orm.Post.where({ title: `${user.firstName}'s` }),
          nullable: true,
        }),
        page: t.prismaConnection({
          type: 'Post',
          select: ['email'],
          resolve: (user) =>
            db.orm.Post.where({ authorId: user.email === 'bob@example.com' ? 'u-bob' : '' }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: 'User', resolve: () => db.orm.User.where({ id: 'u-bob' }) }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ user { latest { id } page { nodes { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.user.latest).toBeNull();
    expect(result.data.user.page.nodes).toHaveLength(2);
  });
});

describe('a selection that fails to plan', () => {
  const fail = () => {
    throw new Error('not allowed');
  };
  const builder = createBuilder();
  builder.prismaObject('User', {
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      relation: t.relation('posts', { nullable: true, query: fail }),
      count: t.relationCount('posts', { where: fail }),
      connection: t.relatedConnection('posts', { query: fail }),
      selected: t.string({
        nullable: true,
        select: fail,
        resolve: () => 'unreachable',
      }),
      asyncSelected: t.string({
        nullable: true,
        select: async () => fail(),
        resolve: () => 'unreachable',
      }),
      nested: t.relation('posts', { nullable: true }),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({
      title: t.exposeString('title'),
      comments: t.relation('comments', { query: fail }),
    }),
  });
  builder.prismaObject('Comment', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        resolve: () => db.orm.User.where({ id: 'u-bob' }),
      }),
    }),
  });
  const schema = builder.toSchema();

  // As in plugin-prisma, the error fails the root field whose query the selection is planned into.
  it.each([
    ['a relation query callback', 'relation { title }'],
    ['a relatedConnection query callback', 'connection { edges { cursor } }'],
    ['a field select function', 'selected'],
    ['an async field select function', 'asyncSelected'],
    ['a relationCount where callback', 'count'],
    ['a relation query callback beneath a relation', 'nested { title comments { id } }'],
  ])('fails the root field for %s that throws', async (_name, field) => {
    const result = await run(schema, `{ users { firstName ${field} } }`);
    expect(result.errors?.map((error) => [error.message, error.path])).toEqual([
      ['not allowed', ['users']],
    ]);
    expect(result.data).toEqual({ users: null });
    expect(result.statements).toHaveLength(0);
  });
});

describe('a connection collection that already includes a relation', () => {
  it('fails the prismaConnection that returns it', async () => {
    const included = () =>
      // The types reject it too, so it is cast to reach the runtime check.
      db.orm.User.include('posts', (posts) => posts.where({ published: 1 })) as never;
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        userPage: t.prismaConnection({ type: 'User', nullable: true, resolve: included }),
      }),
    });
    const result = await run(builder.toSchema(), '{ userPage { edges { node { id } } } }');
    expect(result.errors?.map((error) => detailOf(error))).toEqual([
      "A collection returned to @pothos/plugin-prisma-next already includes 'posts'. Return it without include(): the plugin includes what the query selects. Filter a relation with its field's `query` option.",
    ]);
    expect(result.statements).toHaveLength(0);
  });
});
