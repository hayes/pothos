import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { buildExampleSchema } from './example/schema';
import {
  columnsOf,
  createBuilder,
  deferSchema,
  run,
  runIncremental,
  useSampleDb,
} from './fixtures/helpers';

const db = useSampleDb();
const example = (source: string, variables?: Record<string, unknown>) =>
  run(buildExampleSchema(db), source, { variables });
const postSubqueries = (sql: string) => (sql.match(/FROM "post"/g) ?? []).length;

describe('directives and fragments', () => {
  it('drops fields excluded by @skip and @include, including through variables', async () => {
    const skipped = await example(
      'query ($no: Boolean!) { users { firstName lastName @skip(if: true) email @include(if: $no) } }',
      { no: false },
    );
    expect(skipped.data.users[0]).toEqual({ firstName: 'Alice' });
    expect(columnsOf(skipped.statements[0].sql, 'user')).toEqual(new Set(['firstName']));

    const kept = await example(
      'query ($yes: Boolean!) { users { firstName @skip(if: false) email @include(if: $yes) } }',
      { yes: true },
    );
    expect(columnsOf(kept.statements[0].sql, 'user')).toEqual(new Set(['firstName', 'email']));
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
    expect(columnsOf(result.statements[0].sql, 'user')).toEqual(new Set(['firstName']));
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
    expect(columnsOf(sql, 'post')).toEqual(new Set(['title', 'published', 'authorId']));
  });

  it('plans deferred fragments into the initial query without a provider', async () => {
    const result = await runIncremental(
      deferSchema(createExampleBuilder()),
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

function createExampleBuilder() {
  const builder = createBuilder();
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
            posts: { where: { published: 1 }, orderBy: (post) => post.createdAt.desc(), limit: 1 },
          },
          resolve: (user) => user.posts[0]?.title ?? null,
        }),
        secondTitle: t.string({
          nullable: true,
          select: { posts: { orderBy: (post) => post.id.asc(), offset: 1, limit: 1 } },
          resolve: (user) => user.posts[0]?.title ?? null,
        }),
        published: t.string({
          select: {
            posts: (sub) => ({
              publishedRows: sub.where({ published: 1 }),
              publishedCount: sub.where({ published: 1 }).count(),
            }),
          },
          resolve: (user) =>
            `${user.publishedCount}: ${user.publishedRows.map((post) => post.title).join(', ')}`,
        }),
        commentCount: t.int({ resolve: (user) => user.comments.length }),
        greeting: t.string({
          args: { formal: t.arg.boolean({ required: true }) },
          select: (args) => (args.formal ? ['lastName'] : ['firstName']),
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
        fromArray fromObject firstPostTitle latestTitle secondTitle published commentCount
        posts { title } informal: greeting(formal: false) formal: greeting(formal: true)
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
        commentCount: 1,
        posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
        informal: 'Hi Alice',
        formal: 'Dear Andrews',
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('reports a select key that is neither a column nor a relation', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        garbled: t.string({ select: { firstNme: true } as never, resolve: () => 'x' }),
        malformed: t.string({
          select: { posts: { whre: { published: 1 } } } as never,
          resolve: () => 'x',
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
    });
    const schema = builder.toSchema();
    const garbled = await run(schema, '{ users { garbled } }');
    expect(garbled.errors?.[0].message).toMatch(/'firstNme' is not a column or relation on User/);
    expect(garbled.statements).toHaveLength(0);
    const malformed = await run(schema, '{ users { malformed } }');
    expect(malformed.errors?.[0].message).toMatch(/unrecognized value shape/);
    expect(malformed.statements).toHaveLength(0);
  });
});

describe('async selects', () => {
  const titles = [{ asyncTitle: 'Hello, Pothos' }, { asyncTitle: 'Draft #1' }];
  function schema() {
    const builder = createBuilder();
    const later = <T>(value: T) => Promise.resolve().then(() => value);
    const Admin = builder.prismaObject('User', {
      variant: 'Admin',
      select: { posts: (sub) => ({ total: sub.count() }) },
      fields: (t) => ({
        total: t.int({ resolve: (user) => user.total }),
        asyncLastName: t.string({
          select: () => later(['lastName'] as const),
          resolve: (user) => (user as { lastName?: string }).lastName ?? 'missing',
        }),
        posts: t.relation('posts'),
      }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({
        asyncTitle: t.string({
          select: () => later(['title'] as const),
          resolve: (post) => (post as { title?: string }).title ?? 'missing',
        }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts'),
        drafts: t.relation('posts', { query: { where: { published: 0 } } }),
        admin: t.variant(Admin),
        postsConnection: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
        pageCount: t.int({
          select: (() =>
            later({
              posts: (sub: { limit(n: number): { count(): unknown } }) => ({
                pageCount: sub.limit(1).count(),
              }),
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
          cursor: 'id',
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

  it('forces a variant select into the row for isNull, whatever the query selects', async () => {
    const builder = createBuilder();
    const Admin = builder.prismaObject('User', {
      variant: 'Admin',
      fields: (t) => ({ lastName: t.exposeString('lastName') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        admin: t.variant(Admin, {
          select: ['firstName'],
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

  it('executes without a contextValue', async () => {
    const result = await execute({
      schema: createExampleBuilder().toSchema(),
      document: parse('{ users { firstName } }'),
    });
    expect(result).toEqual({ data: { users: [{ firstName: 'Alice' }, { firstName: 'Bob' }] } });
  });
});
