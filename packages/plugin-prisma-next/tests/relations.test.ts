import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import { Collection } from '@prisma/orm-family-sql/orm-client';
import sqlite from '@prisma/orm-sqlite/runtime';
import { GraphQLError, type GraphQLFieldResolver, GraphQLScalarType, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import PrismaNextPlugin from '../src';
import { buildExampleSchema } from './example/schema';
import { detailOf } from './fixtures/errors';
import {
  createBuilder,
  postSubqueries,
  run,
  type SampleContract,
  type SampleOptions,
  sampleContract,
  useCollisionDb,
  useDatabase,
  useSampleDb,
} from './fixtures/helpers';
import { junctionContract, junctionDdl } from './fixtures/junction';

const db = useSampleDb();

describe('includes', () => {
  it("follows the builder's default field nullability, never the contract's", () => {
    const sdl = printSchema(buildExampleSchema(db));
    expect(sdl).toMatch(/type User implements Node \{[^}]*\n {2}posts: \[Post!\]\n/);
    expect(sdl).toMatch(/type Post \{[^}]*\n {2}author: User\n/);

    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      DefaultFieldNullability: false;
    }>({
      plugins: [PrismaNextPlugin],
      prismaNext: { client: db.client },
      defaultFieldNullability: false,
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id'), posts: t.relation('posts') }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author', { nullable: true }) }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    const strict = printSchema(builder.toSchema());
    expect(strict).toMatch(/type Post \{\n {2}author: User\n/);
    expect(strict).toMatch(/type User \{[^}]*\n {2}posts: \[Post!\]!\n/);
  });

  it('applies an orderBy array in order, the later selectors breaking ties', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          query: { orderBy: { authorId: 'asc', title: 'desc' } },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { posts { id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { posts: [{ id: 'p-hello' }, { id: 'p-draft1' }] },
      { posts: [{ id: 'p-bob1' }, { id: 'p-bob-draft' }] },
    ]);
  });

  it('places nulls last by default, unless the orderBy says otherwise', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        byScore: t.relation('posts', { query: { orderBy: { score: 'desc' } } }),
        nullsFirst: t.relation('posts', {
          query: { orderBy: { score: { direction: 'asc', nulls: 'first' } } },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { byScore { id } nullsFirst { id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      byScore: [{ id: 'p-draft1' }, { id: 'p-hello' }],
      nullsFirst: [{ id: 'p-hello' }, { id: 'p-draft1' }],
    });
    expect(result.statements[0].sql).toMatch(/DESC NULLS LAST/);
    expect(result.statements[0].sql).toMatch(/ASC NULLS FIRST/);
  });

  it('rejects an orderBy column that is not a field when the schema is built', () => {
    const relation = createBuilder();
    relation.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    relation.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', { query: { orderBy: { nope: 'asc' } as never } }),
      }),
    });
    expect(() => relation.toSchema()).toThrow(
      "orderBy can't order by 'Post.nope' is not a field of the model.",
    );

    const select = createBuilder();
    select.prismaObject('User', {
      fields: (t) => ({
        first: t.string({
          nullable: true,
          select: { posts: { orderBy: { nope: 'asc' } as never, limit: 1 } },
          resolve: () => null,
        }),
      }),
    });
    select.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => select.toSchema()).toThrow(
      "orderBy can't order by 'Post.nope' is not a field of the model.",
    );
  });

  it("fails the field for a callback's orderBy column that is not a field", async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          args: { sort: t.arg.string({ required: true }) },
          query: (args) => ({ orderBy: { [args.sort]: 'asc' } }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], collection: () => db.orm.User }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { posts(sort: "nope") { id } } }');
    expect(result.errors?.[0].message).toBe('Unexpected error.');
    expect(detailOf(result.errors?.[0])).toBe(
      "orderBy can't order by 'Post.nope' is not a field of the model.",
    );
  });

  describe('the non-FK side of a 1:1', () => {
    const collision = useCollisionDb();

    function schema() {
      const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
        plugins: [PrismaNextPlugin],
        prismaNext: { client: collision.client },
      });
      builder.prismaObject('Profile', {
        fields: (t) => ({ id: t.exposeID('id'), owner: t.relation('owner') }),
      });
      builder.prismaObject('Owner', {
        fields: (t) => ({ id: t.exposeID('id'), profile: t.relation('profile') }),
      });
      builder.queryType({
        fields: (t) => ({
          owners: t.prismaField({
            type: ['Owner'],
            collection: () => collision.orm.Owner.orderBy((o) => o.id.asc()),
          }),
        }),
      });
      return builder.toSchema();
    }

    it('resolves to null when the row is absent', async () => {
      const sdl = printSchema(schema());
      expect(sdl).toMatch(/type Owner \{[^}]*profile: Profile\n/);
      expect(sdl).toMatch(/type Profile \{[^}]*owner: Owner\n/);
      const result = await run(schema(), '{ owners { id profile { id owner { id } } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.owners).toEqual([
        { id: '1', profile: { id: '5', owner: { id: '1' } } },
        { id: '2', profile: null },
      ]);
    });

    function strictSchema(onNull: 'error' | (() => unknown)) {
      const builder = new SchemaBuilder<{
        PrismaNextContract: typeof collision.contract;
        DefaultFieldNullability: false;
      }>({
        plugins: [PrismaNextPlugin],
        prismaNext: { client: collision.client },
        defaultFieldNullability: false,
      });
      builder.prismaObject('Profile', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.prismaObject('Owner', {
        fields: (t) => ({
          id: t.exposeID('id'),
          profile: t.relation('profile', { onNull: onNull as 'error' }),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          owners: t.prismaField({
            type: ['Owner'],
            nullable: { list: false, items: true },
            collection: () => collision.orm.Owner.orderBy((o) => o.id.asc()),
          }),
        }),
      });
      return builder.toSchema();
    }

    it("leaves a missing row to GraphQL's non-null error with onNull: 'error'", async () => {
      const schema = strictSchema('error');
      expect(printSchema(schema)).toMatch(/type Owner \{[^}]*profile: Profile!\n/);
      const result = await run(schema, '{ owners { id profile { id } } }');
      expect(result.data.owners).toEqual([{ id: '1', profile: { id: '5' } }, null]);
      expect(result.errors?.[0].message).toBe(
        'Cannot return null for non-nullable field Owner.profile.',
      );
      expect(result.errors?.[0].path).toEqual(['owners', 1, 'profile']);
    });

    it('resolves a missing row with an onNull function', async () => {
      const fallback = await run(
        strictSchema(() => ({ id: 0 })),
        '{ owners { id profile { id } } }',
      );
      expect(fallback.errors).toBeUndefined();
      expect(fallback.data.owners).toEqual([
        { id: '1', profile: { id: '5' } },
        { id: '2', profile: { id: '0' } },
      ]);

      const failed = await run(
        strictSchema(() => new Error('No profile')),
        '{ owners { id profile { id } } }',
      );
      expect(failed.data.owners).toEqual([{ id: '1', profile: { id: '5' } }, null]);
      expect(failed.errors?.[0].message).toBe('No profile');
    });
  });

  it('reports a relation reached from a parent row that does not exist', async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id'), posts: t.relation('posts') }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        // @ts-expect-error a row built by hand isn't planned; it reloads
        rawUser: t.field({ type: User, resolve: () => ({ id: 'u-1' }) }),
      }),
    });
    const result = await run(builder.toSchema(), '{ rawUser { id posts { id } } }');
    expect(detailOf(result.errors?.[0])).toMatch(/could not find the 'User' row/);
    expect(result.errors?.[0].path).toEqual(['rawUser', 'posts']);
  });
});

describe('many-to-many relations', () => {
  const junction = useDatabase(junctionContract, junctionDdl);

  function schema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof junctionContract }>({
      plugins: [PrismaNextPlugin],
      prismaNext: { client: junction.client },
    });
    const b = builder as unknown as {
      prismaObject(name: string, options: { fields: (t: never) => object }): unknown;
    };
    type T = {
      exposeString(name: string): unknown;
      relation(name: string, options?: object): unknown;
    };
    b.prismaObject('Tag', { fields: (t: T) => ({ name: t.exposeString('name') }) });
    b.prismaObject('Post', {
      fields: (t: T) => ({
        title: t.exposeString('title'),
        tags: t.relation('tags'),
        graphqlTags: t.relation('tags', {
          query: { where: (tag: { name: { eq(v: string): unknown } }) => tag.name.eq('graphql') },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'] as never,
          collection: () => (junction.orm as unknown as { Post: never }).Post,
        }),
      }),
    });
    return builder.toSchema();
  }

  it('loads an N:M relation and a refined alias of it in one statement', async () => {
    const result = await run(schema(), '{ posts { title tags { name } graphqlTags { name } } }');
    expect(result.errors).toBeUndefined();
    expect(
      result.data.posts.map((post: { tags: { name: string }[] }) => ({
        ...post,
        tags: post.tags.map((tag) => tag.name).sort(),
      })),
    ).toEqual([
      { title: 'Hello, Pothos', tags: ['graphql', 'intro'], graphqlTags: [{ name: 'graphql' }] },
      { title: 'On ORMs', tags: ['database', 'graphql'], graphqlTags: [{ name: 'graphql' }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

describe('relation queries', () => {
  it('passes field args and the request context to a query callback, and ORM tools to where', async () => {
    const seen: unknown[] = [];
    const tools: Record<string, unknown> = {};
    const builder = createBuilder<{ tenant: string }>();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        filtered: t.relation('posts', {
          args: { published: t.arg.int(), limit: t.arg.int() },
          query: (args, context) => {
            seen.push({ args, context });
            return {
              where: args.published == null ? undefined : { published: args.published },
              orderBy: { id: 'desc' },
              limit: args.limit ?? undefined,
              offset: 0,
            };
          },
        }),
        query: t.relation('posts', {
          query: {
            where: (post, orm) => {
              tools.query = orm.fns;
              return post.id.neq('x');
            },
          },
        }),
        total: t.relationCount('posts', {
          query: () => ({
            where: (post, orm) => {
              tools.aggregate = orm.fns;
              return post.id.neq('x');
            },
          }),
        }),
        conn: t.relatedConnection('posts', {
          query: {
            where: (post, orm) => {
              tools.connection = orm.fns;
              return post.id.neq('x');
            },
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { filtered(published: 1, limit: 1) { id } query { id } total conn(first: 1) { nodes { id } } } }',
      { context: { tenant: 't-1' } },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        filtered: [{ id: 'p-hello' }],
        query: [{ id: 'p-hello' }, { id: 'p-draft1' }],
        total: 2,
        conn: { nodes: [{ id: 'p-draft1' }] },
      },
    ]);
    expect(seen).toEqual([{ args: { published: 1, limit: 1 }, context: { tenant: 't-1' } }]);
    expect(tools).toEqual({
      query: expect.anything(),
      aggregate: expect.anything(),
      connection: expect.anything(),
    });
    expect(result.statements).toHaveLength(1);
  });
});

describe('counts and aggregates', () => {
  it('counts related rows, optionally filtered by a where object or an args callback', async () => {
    const result = await run(
      buildExampleSchema(db),
      '{ users { postCount publishedCount zero: countByFlag(flag: 0) one: countByFlag(flag: 1) } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { postCount: 2, publishedCount: 1, zero: 1, one: 1 },
      { postCount: 2, publishedCount: 1, zero: 1, one: 1 },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('reads other aggregates from a select function entry', async () => {
    const builder = new SchemaBuilder<{
      PrismaNextContract: typeof db.contract;
      Scalars: { BigInt: { Input: bigint; Output: bigint } };
    }>({ plugins: [PrismaNextPlugin], prismaNext: { client: db.client } });
    builder.addScalarType(
      'BigInt',
      new GraphQLScalarType({ name: 'BigInt', serialize: (value) => String(value) }),
    );
    builder.prismaObject('User', {
      fields: (t) => ({
        stats: t.string({
          select: {
            total: { posts: (sub) => sub.sum('score') },
            average: { posts: (sub) => sub.avg('score') },
            minimumTitle: { posts: (sub) => sub.min('title') },
            missing: { posts: (sub) => sub.where({ id: 'absent' }).sum('score') },
          },
          resolve: (user) => `${user.total}/${user.average}/${user.minimumTitle}/${user.missing}`,
        }),
        countBigInt: t.field({
          type: 'BigInt',
          select: { countBigInt: { posts: (sub) => sub.countBigInt() } },
          resolve: (user) => user.countBigInt,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { stats countBigInt } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({ stats: '3.75/1.875/Draft #1/null', countBigInt: '2' });
    expect(result.statements).toHaveLength(1);
  });
});

describe('aliases of one to-many relation', () => {
  function schema(options: SampleOptions = {}) {
    const builder = createBuilder(options);
    builder.prismaObject('Comment', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        title: t.exposeString('title'),
        author: t.relation('author'),
        comments: t.relation('comments', { query: { orderBy: { id: 'asc' } } }),
        commentTotal: t.relationCount('comments'),
        commentPage: t.relatedConnection('comments', { totalCount: true }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        email: t.exposeString('email'),
        posts: t.relation('posts', { query: () => ({ orderBy: { id: 'asc' } }) }),
        filtered: t.relation('posts', {
          args: { published: t.arg.int() },
          query: (args) => ({
            where: { published: args.published ?? 0 },
            orderBy: { id: 'asc' },
          }),
        }),
        page: t.relatedConnection('posts', {}),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.orderBy((u) => u.id.asc()),
        }),
        posts: t.prismaField({
          type: ['Post'],
          collection: () => db.orm.Post.orderBy((p) => p.id.asc()).limit(2),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('loads aliases with different args in the same statement', async () => {
    const result = await run(
      buildExampleSchema(db),
      `{ users {
        posts { id } drafts { id } publishedPosts { id }
        zero: postsByPublished(published: 0) { id } one: postsByPublished(published: 1) { id }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      posts: [{ id: 'p-hello' }, { id: 'p-draft1' }],
      drafts: [{ id: 'p-draft1' }],
      publishedPosts: [{ id: 'p-hello' }],
      zero: [{ id: 'p-draft1' }],
      one: [{ id: 'p-hello' }],
    });
    expect(result.statements).toHaveLength(1);
  });

  it.each([
    [
      '{ users { a: posts { id } b: posts { title } } }',
      {
        a: [{ id: 'p-draft1' }, { id: 'p-hello' }],
        b: [{ title: 'Draft #1' }, { title: 'Hello, Pothos' }],
      },
    ],
    [
      '{ users { a: page(first: 1) { nodes { id } } b: page(first: 1) { nodes { title } } } }',
      { a: { nodes: [{ id: 'p-draft1' }] }, b: { nodes: [{ title: 'Draft #1' }] } },
    ],
  ])('reads aliases with equal arguments from one subquery: %s', async (source, user) => {
    const result = await run(schema(), source);
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual(user);
    expect(result.statements).toHaveLength(1);
    expect(postSubqueries(result.statements[0].sql)).toBe(1);
  });

  it('keeps aliases with different arguments in separate subqueries', async () => {
    const result = await run(
      schema(),
      '{ users { a: filtered(published: 1) { id } b: filtered(published: 0) { id } } }',
    );
    expect(result.data.users[0]).toEqual({ a: [{ id: 'p-hello' }], b: [{ id: 'p-draft1' }] });
    expect(postSubqueries(result.statements[0].sql)).toBe(2);
  });

  it('keeps consumers apart when one child alias names different fields', async () => {
    const result = await run(
      schema(),
      '{ users { a: posts { x: comments { id } } b: posts { x: commentTotal } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      a: [{ x: [] }, { x: [{ id: 'c-1' }, { id: 'c-2' }] }],
      b: [{ x: 0 }, { x: 2 }],
    });
  });

  it('merges one callback-query field selected through fragments', async () => {
    const s = schema();
    const toOne = await run(s, '{ posts { id author { id } ... on Post { author { email } } } }');
    expect(toOne.errors).toBeUndefined();
    expect(toOne.data.posts[0]).toEqual({
      id: 'p-bob-draft',
      author: { id: 'u-bob', email: 'bob@example.com' },
    });
    expect(toOne.statements).toHaveLength(1);

    const toMany = await run(s, '{ users { posts { id } ... { posts { title } } } }');
    expect(toMany.data.users[0].posts[0]).toEqual({ id: 'p-draft1', title: 'Draft #1' });
    expect(toMany.statements).toHaveLength(1);

    const nested = await run(
      s,
      '{ users { posts { commentPage(first: 1) { totalCount } } ... { posts { commentPage(first: 1) { nodes { id } } } } } }',
    );
    expect(nested.errors).toBeUndefined();
    expect(nested.data.users[0].posts[1].commentPage).toEqual({
      totalCount: 2,
      nodes: [{ id: 'c-1' }],
    });
  });
});

describe('to-one consumers', () => {
  function schema({
    directResult = false,
    dataName = 'data',
    staticFilters = false,
  }: {
    directResult?: boolean;
    dataName?: string;
    staticFilters?: boolean;
  } = {}) {
    const builder = createBuilder();
    const filter = (published: number | null | undefined, fixed: number) =>
      staticFilters
        ? { where: { published: fixed } }
        : published == null
          ? {}
          : { where: { published } };
    const UserView = builder.prismaObject('User', {
      variant: 'UserView',
      fields: (t) => ({
        posts: t.relation('posts', {
          args: { published: t.arg.int() },
          query: ({ published }) => filter(published, 0),
        }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        firstName: t.exposeString('firstName'),
        view: t.variant(UserView),
        postCount: t.int({
          args: { published: t.arg.int({ required: true }) },
          select: (args) => ({
            postCount: { posts: (sub) => sub.where({ published: args.published }).count() },
          }),
          resolve: (user) => user.postCount,
        }),
        posts: t.relation('posts', {
          args: { published: t.arg.int() },
          query: ({ published }) => filter(published, 1),
        }),
      }),
    });
    const titles = (published: number) =>
      builder.prismaObject('User', {
        variant: published ? 'PublishedAuthor' : 'DraftAuthor',
        fields: (t) => ({
          titles: t.string({
            select: { posts: { where: { published } } },
            resolve: (user) => user.posts.map((post) => post.title).join(','),
          }),
        }),
      });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        author: t.relation('author'),
        wrapped: t.relation('author', {
          errors: { types: [], directResult, dataField: { name: dataName } },
        }),
        publishedAuthor: t.relation('author', { type: titles(1) }),
        draftAuthor: t.relation('author', { type: titles(0) }),
      }),
    });
    builder.prismaObject('Comment', { fields: (t) => ({ post: t.relation('post') }) });
    builder.queryType({
      fields: (t) => ({
        comments: t.prismaField({
          type: ['Comment'],
          collection: () => db.orm.Comment.where({ id: 'c-1' }),
        }),
        posts: t.prismaField({
          type: ['Post'],
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  const published = { posts: [{ id: 'p-hello' }] };
  const drafts = { posts: [{ id: 'p-draft1' }] };
  const posts = (selection: string) => `{ posts { ${selection} } }`;

  it('shares one include across aliases of a to-one relation, keeping their selections apart', async () => {
    const result = await run(
      schema(),
      posts(`
        a: author { id posts(published: 1) { id } view { posts(published: 1) { id } } postCount(published: 1) }
        b: author { firstName posts(published: 0) { id } view { posts(published: 0) { id } } postCount(published: 9) }
        c: author { posts { a: author { posts(published: 1) { id } } b: author { posts(published: 0) { id } } } }
        publishedAuthor { titles }
        draftAuthor { titles }
      `),
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      {
        a: { id: 'u-alice', ...published, view: published, postCount: 1 },
        b: { firstName: 'Alice', ...drafts, view: drafts, postCount: 0 },
        c: { posts: [0, 1].map(() => ({ a: published, b: drafts })) },
        publishedAuthor: { titles: 'Hello, Pothos' },
        draftAuthor: { titles: 'Draft #1' },
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('keeps aliases of same-row variants apart under aliases and an errors wrapper', async () => {
    const views = 'a: view { posts(published: 1) { id } } b: view { posts(published: 0) { id } }';
    const result = await run(
      schema(),
      `{
        aliased: posts { a: author { id } b: author { firstName ${views} } }
        wrapped: posts {
          a: wrapped { ... on PostWrappedSuccess { data { ${views} } } }
          b: wrapped { ... on PostWrappedSuccess { data { view { posts(published: 0) { id } } } } }
        }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      aliased: [{ a: { id: 'u-alice' }, b: { firstName: 'Alice', a: published, b: drafts } }],
      wrapped: [{ a: { data: { a: published, b: drafts } }, b: { data: { view: drafts } } }],
    });
    // One per root field.
    expect(result.statements).toHaveLength(2);
  });

  it('keeps child scopes through consecutive to-one includes and a single-consumer one', async () => {
    const result = await run(
      schema(),
      `{
        consecutive: comments {
          a: post { author { posts(published: 1) { id } } }
          b: post { author { posts(published: 0) { id } } }
        }
        single: comments {
          post { a: author { posts(published: 1) { id } } b: author { posts(published: 0) { id } } }
        }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      consecutive: [{ a: { author: published }, b: { author: drafts } }],
      single: [{ post: { a: published, b: drafts } }],
    });
  });

  it('keeps variant static refinements apart from the base type', async () => {
    const result = await run(
      schema({ staticFilters: true }),
      '{ posts { author { posts { id } view { posts { id } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([{ author: { posts: [{ id: 'p-hello' }], view: drafts } }]);
  });

  it.each([
    false,
    true,
  ])('scopes nested aliases through errors wrappers with a renamed dataField (directResult: %s)', async (direct) => {
    const wrap = (body: string) =>
      direct
        ? `... on User { ${body} }`
        : `... on PostWrappedSuccess { payload: value { ${body} } }`;
    const unwrap = (value: object) => (direct ? value : { payload: value });
    const inner = (published: number) => wrap(`posts(published: ${published}) { id }`);
    const result = await run(
      schema({ directResult: direct, dataName: 'value' }),
      posts(`
        a: wrapped { ${wrap(`posts { x: wrapped { ${inner(1)} } y: wrapped { ${inner(0)} } }`)} }
        b: wrapped { ${inner(0)} }
      `),
    );
    expect(result.errors).toBeUndefined();
    const row = { x: unwrap(published), y: unwrap(drafts) };
    expect(result.data.posts).toEqual([{ a: unwrap({ posts: [row, row] }), b: unwrap(drafts) }]);
  });
});

describe('plugins that wrap resolvers', () => {
  // Listed before prismaNext, its onOutputFieldConfig runs after prismaNext's.
  class WrapResolvePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
      const { resolve } = fieldConfig;
      return resolve
        ? { ...fieldConfig, resolve: (...args: Parameters<typeof resolve>) => resolve(...args) }
        : fieldConfig;
    }
  }
  SchemaBuilder.registerPlugin('prismaNextTestWrapResolve' as never, WrapResolvePlugin);

  it('resolves a filtered relation from its own rows when its resolver is wrapped', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: ['prismaNextTestWrapResolve' as never, PrismaNextPlugin],
      prismaNext: { client: db.client },
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      select: { posts: true },
      fields: (t) => ({
        postCount: t.int({ resolve: (user) => user.posts.length }),
        published: t.relation('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { postCount published { id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { postCount: 2, published: [{ id: 'p-hello' }] },
      { postCount: 2, published: [{ id: 'p-bob1' }] },
    ]);
  });

  // Listed after prismaNext, it wraps the resolver inside prismaNext's wrapper, and hands it a new
  // object with the parent's columns.
  class ReplaceParentPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(
      resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
      fieldConfig: PothosOutputFieldConfig<Types>,
    ): GraphQLFieldResolver<unknown, Types['Context'], object> {
      const columns = (parent: object) =>
        Object.fromEntries(
          Object.entries(parent).filter(([, value]) => value === null || typeof value !== 'object'),
        );
      return fieldConfig.name.startsWith('replaced')
        ? (parent, args, context, info) => resolver(columns(parent as object), args, context, info)
        : resolver;
    }
  }
  SchemaBuilder.registerPlugin('prismaNextTestReplaceParent' as never, ReplaceParentPlugin);

  // A new object holds the row's columns, but not a helper's slots.
  it('reloads the parent of a field helper when another plugin replaced it', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [PrismaNextPlugin, 'prismaNextTestReplaceParent' as never],
      prismaNext: { client: db.client },
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      select: { posts: true },
      fields: (t) => ({
        kept: t.relationCount('posts'),
        replaced: t.relationCount('posts'),
        replacedPublished: t.relation('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { kept replaced replacedPublished { id } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { kept: 2, replaced: 2, replacedPublished: [{ id: 'p-hello' }] },
    ]);
    // The two replaced parents reload in one batch.
    expect(result.statements).toHaveLength(2);
  });

  // A keyless row can't be reloaded: without a key every parent would read the first row.
  it('fails a field helper whose replaced parent has no key to reload it by', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [PrismaNextPlugin, 'prismaNextTestReplaceParent' as never],
      prismaNext: { client: db.client },
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('PostView', {
      fields: (t) => ({
        viewer: t.exposeString('viewer'),
        replacedPost: t.relation('post', { nullable: true }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        views: t.prismaField({
          type: ['PostView'],
          collection: () => db.orm.PostView.orderBy((view) => view.viewer.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ views { viewer replacedPost { id } } }');
    expect(result.errors).toHaveLength(3);
    for (const error of result.errors!) {
      expect(detailOf(error)).toMatch(
        /^Field 'PostView\.replacedPost' needs its parent reloaded, but model 'PostView' has no non-null primary or unique key/,
      );
      // A developer's error, which a server that masks errors hides from the client.
      expect(error.originalError).toBeInstanceOf(Error);
      expect(error.originalError).not.toBeInstanceOf(GraphQLError);
    }
    expect(result.data.views).toEqual(
      ['Alice', 'Bob', 'Carol'].map((viewer) => ({ viewer, replacedPost: null })),
    );
    expect(result.statements).toHaveLength(1);
  });
});

describe('plugins that pass resolvers a shallow copy of the parent', () => {
  // Hands the resolvers of User and Post fields `{ ...parent }`, before or after prismaNext's
  // wrapper. With `context.copyPosts`, the copy's `posts` is a new list. For the aliases
  // `context.dropHello` lists, the copy's `posts` lacks 'p-hello'. With
  // `context.published`, `User.posts` gets a parent built by hand around another field's list.
  class CopyParentPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(
      resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
      fieldConfig: PothosOutputFieldConfig<Types>,
    ): GraphQLFieldResolver<unknown, Types['Context'], object> {
      if (!['User', 'Post'].includes(fieldConfig.parentType)) {
        return resolver;
      }
      return (parent, args, context, info) => {
        const copy: Record<string, unknown> = { ...(parent as object) };
        const { dropHello, published } = context as {
          dropHello?: string[];
          published?: Map<unknown, unknown>;
        };
        if ((context as { copyPosts?: boolean }).copyPosts && Array.isArray(copy.posts)) {
          copy.posts = [...copy.posts];
        }
        if (dropHello?.includes(info.path.key as string) && Array.isArray(copy.posts)) {
          copy.posts = copy.posts.filter((post: { id: string }) => post.id !== 'p-hello');
        }
        // Keeps the published posts `titles` sees, and builds `posts` a parent holding them.
        if (published && fieldConfig.name === 'titles') {
          published.set(copy.id, copy.posts);
        }
        if (published && fieldConfig.name === 'posts') {
          return resolver({ id: copy.id, posts: published.get(copy.id) }, args, context, info);
        }
        return resolver(copy, args, context, info);
      };
    }
  }
  SchemaBuilder.registerPlugin('prismaNextTestCopyParent' as never, CopyParentPlugin);

  function schema(position: 'before' | 'after' | 'none') {
    const copy = 'prismaNextTestCopyParent' as never;
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins:
        position === 'before'
          ? [copy, PrismaNextPlugin]
          : position === 'after'
            ? [PrismaNextPlugin, copy]
            : [PrismaNextPlugin],
      prismaNext: { client: db.client },
    });
    builder.prismaObject('Comment', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        author: t.relation('author'),
        comments: t.relation('comments'),
      }),
    });
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        comments: t.relation('comments'),
        posts: t.relation('posts'),
        ordered: t.relation('posts', { query: { orderBy: { id: 'asc' } } }),
        published: t.relation('posts', { query: { where: { published: 1 } } }),
        postCount: t.relationCount('posts'),
        titles: t.stringList({
          select: { posts: { where: { published: 0 } } },
          resolve: (user) => user.posts.map((post) => post.title),
        }),
        postIds: t.stringList({
          select: { posts: true },
          resolve: (user) => user.posts.map((post) => post.id),
        }),
      }),
    });
    builder.prismaObjectFields(User, (t) => ({
      // Parents built by hand, with the published posts as `posts`, and the row's comments.
      twin: t.field({
        type: User,
        select: { comments: true, posts: { where: { published: 1 } } },
        resolve: (user) => ({ id: user.id, comments: user.comments, posts: user.posts }) as never,
      }),
      bare: t.field({
        type: User,
        select: { posts: { where: { published: 1 } } },
        resolve: (user) => ({ id: user.id, posts: user.posts }) as never,
      }),
    }));
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

  // A copy keeps the row's combined values under their symbol, so nothing reloads.
  it.each([
    ['{ users { posts { id } } }', 1, 1],
    ['{ users { posts { author { id } } } }', 1, 1],
    ['{ users { posts { author { posts { author { posts { id } } } } } } }', 1, 1],
    ['{ users { posts { comments { id } author { id } } } }', 1, 1],
    [
      '{ users { comments { id } published { id comments { id } author { id } } postCount titles } }',
      1,
      1,
    ],
    ['{ users { published { id } postCount titles } }', 1, 1],
  ] as const)('resolves a copied parent as the row: %s', async (query, before, after) => {
    const expected = await run(schema('none'), query);
    expect(expected.errors).toBeUndefined();
    expect(expected.statements).toHaveLength(1);
    for (const [position, count] of [
      ['before', before],
      ['after', after],
    ] as const) {
      const result = await run(schema(position), query);
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expected.data);
      expect(result.statements).toHaveLength(count);
    }
  });

  it('reloads a parent whose relation a plugin replaced with a new list', async () => {
    for (const query of [
      '{ users { comments { id } posts { id } } }',
      '{ users { posts { id } } }',
      '{ users { comments { id } posts { id } published { id } postCount } }',
    ]) {
      const expected = await run(schema('none'), query);
      for (const position of ['before', 'after'] as const) {
        const result = await run(schema(position), query, { context: { copyPosts: true } });
        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual(expected.data);
      }
    }
  });

  it.each([
    '{ users { id a: postIds b: postIds ordered { id } } }',
    '{ users { id comments { id } a: postIds b: postIds ordered { id } } }',
  ])('keeps the relations a plugin changed on its copy: %s', async (query) => {
    for (const position of ['before', 'after'] as const) {
      const result = await run(schema(position), query, { context: { dropHello: ['a'] } });
      expect(result.errors).toBeUndefined();
      const [alice] = result.data.users;
      // A plugin listed before this one sees the parent without what the field's select loads, so
      // its copy has no `posts` to change.
      expect([...alice.a].sort()).toEqual(
        position === 'after' ? ['p-draft1'] : ['p-draft1', 'p-hello'],
      );
      expect([...alice.b].sort()).toEqual(['p-draft1', 'p-hello']);
      expect(alice.ordered).toEqual([{ id: 'p-draft1' }, { id: 'p-hello' }]);
    }
  });

  it('never serves a filtered list a parent built by hand holds as the whole relation', async () => {
    const result = await run(
      schema('none'),
      '{ users { id twin { posts { id } } bare { posts { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    const [alice] = result.data.users;
    for (const parent of [alice.twin, alice.bare]) {
      expect(parent.posts.map((post: { id: string }) => post.id).sort()).toEqual([
        'p-draft1',
        'p-hello',
      ]);
    }
    // `titles` loads the drafts, which the plugin hands `posts` as its parent's.
    const swapped = await run(schema('before'), '{ users { titles posts { id } } }', {
      context: { published: new Map() },
    });
    expect(swapped.errors).toBeUndefined();
    expect(swapped.data.users[0].titles).toEqual(['Draft #1']);
    expect(swapped.data.users[0].posts.map((post: { id: string }) => post.id).sort()).toEqual([
      'p-draft1',
      'p-hello',
    ]);
  });
});

describe('empty queries', () => {
  const ownerBuilder = (options: object) => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({ posts: t.relation('posts', options as never) }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    return builder;
  };

  it.each([
    ['nothing', () => undefined],
    ['an empty object', () => ({})],
    ['undefined options', () => ({ where: undefined })],
  ])('loads every row for a query callback that returns %s', async (_name, query) => {
    const result = await run(ownerBuilder({ query }).toSchema(), '{ users { posts { id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].posts).toHaveLength(2);
  });
});

describe('aliases of one computed value', () => {
  const builder = createBuilder();
  builder.prismaObject('User', {
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      postCount: t.relationCount('posts'),
      publishedCount: t.relationCount('posts', {
        args: { published: t.arg.int({ required: true }) },
        query: (args) => ({ where: { published: args.published } }),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        collection: () => db.orm.User.orderBy((user) => user.id.asc()),
      }),
    }),
  });
  const schema = builder.toSchema();
  const counts = (sql: string) => sql.match(/COUNT\(\*\)/g)?.length ?? 0;

  it('computes a value once for every alias that selects it the same way', async () => {
    const aliases = Array.from({ length: 70 }, (_, i) => `a${i}: postCount`).join(' ');
    const result = await run(schema, `{ users { firstName ${aliases} } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toMatchObject({ firstName: 'Alice', a0: 2, a69: 2 });
    expect(result.statements).toHaveLength(1);
    expect(counts(result.statements[0]!.sql)).toBe(1);
  });

  it('computes aliases with different arguments separately', async () => {
    const result = await run(
      schema,
      '{ users { a: publishedCount(published: 1) b: publishedCount(published: 1) c: publishedCount(published: 0) } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { a: 1, b: 1, c: 1 },
      { a: 1, b: 1, c: 1 },
    ]);
    expect(counts(result.statements[0]!.sql)).toBe(2);
  });
});

describe("relationCount's query", () => {
  const builder = createBuilder();
  builder.prismaObject('User', {
    fields: (t) => ({
      shorthand: t.relationCount('posts', { query: { where: { published: 1 } } }),
      predicate: t.relationCount('posts', { query: { where: (post) => post.published.eq(0) } }),
      callback: t.relationCount('posts', {
        args: { published: t.arg.int() },
        query: (args) =>
          args.published == null ? undefined : { where: { published: args.published } },
      }),
      predicateCallback: t.relationCount('posts', {
        args: { title: t.arg.string({ required: true }) },
        query: (args) => ({ where: (post) => post.title.neq(args.title) }),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        collection: () => db.orm.User.where({ id: 'u-alice' }),
      }),
    }),
  });
  const schema = builder.toSchema();

  it('counts with a literal where or a callback returning one, in one statement', async () => {
    const result = await run(
      schema,
      `{ users {
        shorthand predicate all: callback published: callback(published: 1)
        predicateCallback(title: "Draft #1")
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { shorthand: 1, predicate: 1, all: 2, published: 1, predicateCallback: 1 },
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

describe("a relation's query callback", () => {
  const published = db.orm.Post.fragment((posts) => posts.where({ published: 1 }));

  function schema(query: unknown, client: typeof db.client = db.client) {
    const builder = createBuilder({ client });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          args: { published: t.arg.int() },
          query: query as never,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => client.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  it.each([
    [
      'a refinement',
      () => (posts: typeof db.orm.Post) => posts.where({ published: 1 }).orderBy((p) => p.id.asc()),
    ],
    [
      'a refinement applying a fragment',
      () => (posts: typeof db.orm.Post) => posts.with(published),
    ],
    ['an async literal', async () => ({ where: { published: 1 } })],
    [
      'an async refinement',
      async () => (posts: typeof db.orm.Post) => posts.where({ published: 1 }),
    ],
  ])('loads the relation with %s in one statement', async (_name, query) => {
    const result = await run(schema(query), '{ users { posts { id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { posts: [{ id: 'p-hello' }] },
      { posts: [{ id: 'p-bob1' }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('reads the args, and keeps aliases with different args apart', async () => {
    const result = await run(
      schema(
        (args: { published?: number | null }) => (posts: typeof db.orm.Post) =>
          args.published == null ? posts : posts.where({ published: args.published }),
      ),
      '{ users { drafts: posts(published: 0) { id } live: posts(published: 1) { id } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { drafts: [{ id: 'p-draft1' }], live: [{ id: 'p-hello' }] },
      { drafts: [{ id: 'p-bob-draft' }], live: [{ id: 'p-bob1' }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it("receives a custom collection's instance, so its methods apply", async () => {
    class PostCollection extends Collection<SampleContract, 'Post'> {
      live() {
        return this.where({ published: 1 });
      }
    }
    const client = sqlite({
      contract: sampleContract,
      path: db.path,
      collections: { Post: PostCollection },
    });
    try {
      // Upstream types an include refinement as the plain collection, so the method is cast to.
      const result = await run(
        schema(() => (posts: PostCollection) => posts.live(), client),
        '{ users { posts { id } } }',
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toEqual([
        { posts: [{ id: 'p-hello' }] },
        { posts: [{ id: 'p-bob1' }] },
      ]);
    } finally {
      await client.close();
    }
  });
});

// The types reject these, so they come from plain JS or a cast. Each would otherwise drop the
// filter beside an unknown option or inside a promise.
