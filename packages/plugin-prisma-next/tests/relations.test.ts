import SchemaBuilder from '@pothos/core';
import { GraphQLScalarType, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { buildExampleSchema } from './example/schema';
import {
  createBuilder,
  run,
  type SampleOptions,
  useCollisionDb,
  useDatabase,
  useSampleDb,
} from './fixtures/helpers';
import { junctionContract, junctionDdl } from './fixtures/junction';

const db = useSampleDb();
const postSubqueries = (sql: string) => (sql.match(/FROM "post"/g) ?? []).length;

describe('includes', () => {
  it('derives relation nullability from the contract, unless overridden', () => {
    const sdl = printSchema(buildExampleSchema(db));
    expect(sdl).toMatch(/type User implements Node \{[^}]*\n {2}posts: \[Post!\]!\n/);
    expect(sdl).toMatch(/type Post \{[^}]*\n {2}author: User!\n/);

    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author', { nullable: true }) }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(printSchema(builder.toSchema())).toMatch(/type Post \{\n {2}author: User\n/);
  });

  it('makes a to-one relation with a query nullable, since the query can filter its row out', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ firstName: t.exposeString('firstName') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        alice: t.relation('author', { query: { where: { firstName: 'Alice' } } }),
        required: t.relation('author', {
          nullable: false,
          query: { where: { firstName: 'Alice' } },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({ type: ['Post'], resolve: () => db.orm.Post }),
      }),
    });
    const schema = builder.toSchema();
    const sdl = printSchema(schema);
    expect(sdl).toMatch(/type Post \{[^}]*\n {2}alice: User\n/);
    expect(sdl).toMatch(/type Post \{[^}]*\n {2}required: User!\n/);
    const result = await run(schema, '{ posts { id alice { firstName } } }');
    expect(result.errors).toBeUndefined();
    const authors = result.data.posts.map((post: { alice: unknown }) => post.alice);
    expect(authors).toContainEqual(null);
    expect(authors).toContainEqual({ firstName: 'Alice' });
  });

  describe('the non-FK side of a 1:1', () => {
    const collision = useCollisionDb();

    function schema() {
      const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
        plugins: [prismaNextPlugin],
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
            resolve: () => collision.orm.Owner.orderBy((o) => o.id.asc()),
          }),
        }),
      });
      return builder.toSchema();
    }

    it('is nullable and resolves to null when the row is absent', async () => {
      const sdl = printSchema(schema());
      expect(sdl).toMatch(/type Owner \{[^}]*profile: Profile\n/);
      expect(sdl).toMatch(/type Profile \{[^}]*owner: Owner!\n/);
      const result = await run(schema(), '{ owners { id profile { id owner { id } } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.owners).toEqual([
        { id: '1', profile: { id: '5', owner: { id: '1' } } },
        { id: '2', profile: null },
      ]);
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
        rawUser: t.field({ type: User, resolve: () => ({ id: 'u-1' }) }),
      }),
    });
    const result = await run(builder.toSchema(), '{ rawUser { id posts { id } } }');
    expect(result.errors?.[0].message).toMatch(/could not find model 'User'/);
    expect(result.errors?.[0].path).toEqual(['rawUser', 'posts']);
  });
});

describe('many-to-many relations', () => {
  const junction = useDatabase(junctionContract, junctionDdl);

  function schema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof junctionContract }>({
      plugins: [prismaNextPlugin],
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
          resolve: () => (junction.orm as unknown as { Post: never }).Post,
        }),
      }),
    });
    return builder.toSchema();
  }

  it('loads both directions of a junction with a nested refinement in one statement', async () => {
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
              orderBy: (post) => post.id.desc(),
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
          where: (post, _args, _ctx, orm) => {
            tools.aggregate = orm.fns;
            return post.id.neq('x');
          },
        }),
        conn: t.relatedConnection('posts', {
          cursor: 'id',
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
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
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

  it('keeps fractional sums and extrema, and applies custom and lossless result scalars', async () => {
    const builder = new SchemaBuilder<{
      PrismaNextContract: typeof db.contract;
      Scalars: {
        Amount: { Input: number; Output: number };
        BigInt: { Input: bigint; Output: bigint };
      };
    }>({ plugins: [prismaNextPlugin], prismaNext: { client: db.client } });
    builder.addScalarType(
      'Amount',
      new GraphQLScalarType({ name: 'Amount', serialize: (value) => Number(value).toFixed(2) }),
    );
    builder.addScalarType(
      'BigInt',
      new GraphQLScalarType({ name: 'BigInt', serialize: (value) => String(value) }),
    );
    builder.prismaObject('User', {
      fields: (t) => ({
        countBigInt: t.relationAggregate('posts', { op: 'countBigInt', type: 'BigInt' }),
        sumBigInt: t.relationAggregate('posts', {
          op: 'sumBigInt',
          field: 'published',
          type: 'BigInt',
        }),
        minimumTitle: t.relationAggregate('posts', { op: 'min', field: 'title', type: 'String' }),
        total: t.relationAggregate('posts', { op: 'sum', field: 'score' }),
        minimum: t.relationAggregate('posts', { op: 'min', field: 'score' }),
        maximum: t.relationAggregate('posts', { op: 'max', field: 'score' }),
        average: t.relationAggregate('posts', { op: 'avg', field: 'score' }),
        amount: t.relationAggregate('posts', { op: 'sum', field: 'score', type: 'Amount' }),
        missing: t.relationAggregate('posts', {
          op: 'sum',
          field: 'score',
          where: { id: 'absent' },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: 'User', resolve: () => db.orm.User.where({ id: 'u-alice' }) }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ user { countBigInt sumBigInt minimumTitle total minimum maximum average amount missing } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({
      countBigInt: '2',
      sumBigInt: '1',
      minimumTitle: 'Draft #1',
      total: 3.75,
      minimum: 1.5,
      maximum: 2.25,
      average: 1.875,
      amount: '3.75',
      missing: null,
    });
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
        author: t.relation('author', { query: () => ({ where: (u) => u.id.neq('nobody') }) }),
        comments: t.relation('comments', { query: { orderBy: (c) => c.id.asc() } }),
        commentTotal: t.relationCount('comments'),
        commentPage: t.relatedConnection('comments', { cursor: 'id', totalCount: true }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        email: t.exposeString('email'),
        posts: t.relation('posts', { query: () => ({ orderBy: (p) => p.id.asc() }) }),
        filtered: t.relation('posts', {
          args: { published: t.arg.int() },
          query: (args) => ({
            where: { published: args.published ?? 0 },
            orderBy: (p) => p.id.asc(),
          }),
        }),
        page: t.relatedConnection('posts', { cursor: 'id' }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((u) => u.id.asc()),
        }),
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.orderBy((p) => p.id.asc()).limit(2),
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
            posts: (sub) => ({ postCount: sub.where({ published: args.published }).count() }),
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
        select: { posts: { where: { published } } },
        fields: (t) => ({
          titles: t.string({ resolve: (user) => user.posts.map((post) => post.title).join(',') }),
        }),
      });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        author: t.relation('author'),
        wrapped: t.relation('author', {
          errors: { types: [], directResult, dataField: { name: dataName } },
        }),
        alice: t.relation('author', { query: { where: { firstName: 'Alice' } } }),
        bob: t.relation('author', { query: { where: { firstName: 'Bob' } } }),
        publishedAuthor: t.relation('author', { type: titles(1) }),
        draftAuthor: t.relation('author', { type: titles(0) }),
      }),
    });
    builder.prismaObject('Comment', { fields: (t) => ({ post: t.relation('post') }) });
    builder.queryType({
      fields: (t) => ({
        comments: t.prismaField({
          type: ['Comment'],
          resolve: () => db.orm.Comment.where({ id: 'c-1' }),
        }),
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  const published = { posts: [{ id: 'p-hello' }] };
  const drafts = { posts: [{ id: 'p-draft1' }] };

  it.each([
    [
      'aliases with distinct nested selections',
      '{ posts { a: author { id } b: author { firstName posts { id } } } }',
      {
        a: { id: 'u-alice' },
        b: { firstName: 'Alice', posts: [{ id: 'p-hello' }, { id: 'p-draft1' }] },
      },
    ],
    [
      'equivalent declarative refinements',
      '{ posts { a: alice { id } b: alice { firstName } } }',
      { a: { id: 'u-alice' }, b: { firstName: 'Alice' } },
    ],
    [
      'type-level selections of two views',
      '{ posts { publishedAuthor { titles } draftAuthor { titles } } }',
      { publishedAuthor: { titles: 'Hello, Pothos' }, draftAuthor: { titles: 'Draft #1' } },
    ],
    [
      'child aliases with different args',
      '{ posts { a: author { posts(published: 1) { id } } b: author { posts(published: 0) { id } } } }',
      { a: published, b: drafts },
    ],
    [
      'child aliases through further to-one relations',
      `{ posts {
        a: author { posts { a: author { posts(published: 1) { id } } b: author { posts(published: 0) { id } } } }
        b: author { posts(published: 0) { id } }
      } }`,
      { a: { posts: [0, 1].map(() => ({ a: published, b: drafts })) }, b: drafts },
    ],
    [
      'same-row variant wrappers',
      '{ posts { a: author { view { posts(published: 1) { id } } } b: author { view { posts(published: 0) { id } } } } }',
      { a: { view: published }, b: { view: drafts } },
    ],
    [
      'function-form child selections',
      '{ posts { a: author { postCount(published: 1) } b: author { postCount(published: 9) } } }',
      { a: { postCount: 1 }, b: { postCount: 0 } },
    ],
    [
      'same-row variants with different child args',
      '{ posts { alice { a: view { posts(published: 1) { id } } b: view { posts(published: 0) { id } } } } }',
      { alice: { a: published, b: drafts } },
    ],
    [
      'errors-wrapped aliases with same-row variants',
      `{ posts {
        a: wrapped { ... on PostWrappedSuccess { data { a: view { posts(published: 1) { id } } b: view { posts(published: 0) { id } } } } }
        b: wrapped { ... on PostWrappedSuccess { data { view { posts(published: 0) { id } } } } }
      } }`,
      {
        a: { data: { a: { posts: [{ id: 'p-hello' }] }, b: drafts } },
        b: { data: { view: drafts } },
      },
    ],
  ])('share one include across %s, keeping their selections apart', async (_name, source, post) => {
    const result = await run(schema(), source);
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([post]);
    expect(result.statements).toHaveLength(1);
  });

  it.each([
    [
      'consecutive to-one includes',
      '{ comments { a: post { author { posts(published: 1) { id } } } b: post { author { posts(published: 0) { id } } } } }',
      { a: { author: published }, b: { author: drafts } },
    ],
    [
      'a single-consumer to-one include',
      '{ comments { post { a: author { posts(published: 1) { id } } b: author { posts(published: 0) { id } } } } }',
      { post: { a: published, b: drafts } },
    ],
  ])('keep child scopes through %s', async (_name, source, comment) => {
    const result = await run(schema(), source);
    expect(result.errors).toBeUndefined();
    expect(result.data.comments).toEqual([comment]);
  });

  it('keeps variant static refinements apart from the base type', async () => {
    const result = await run(
      schema({ staticFilters: true }),
      '{ posts { alice { posts { id } view { posts { id } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([{ alice: { posts: [{ id: 'p-hello' }], view: drafts } }]);
  });

  it.each([
    false,
    true,
  ])('scopes nested aliases through errors wrappers (directResult: %s)', async (direct) => {
    const wrap = (body: string) =>
      direct
        ? `... on User { ${body} }`
        : `... on PostWrappedSuccess { payload: data { ${body} } }`;
    const unwrap = (value: object) => (direct ? value : { payload: value });
    const inner = (published: number) => wrap(`posts(published: ${published}) { id }`);
    const result = await run(
      schema({ directResult: direct }),
      `{ posts {
        a: wrapped { ${wrap(`posts { x: wrapped { ${inner(1)} } y: wrapped { ${inner(0)} } }`)} }
        b: wrapped { ${inner(0)} }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    const row = { x: unwrap(published), y: unwrap(drafts) };
    expect(result.data.posts).toEqual([{ a: unwrap({ posts: [row, row] }), b: unwrap(drafts) }]);
  });

  it('keeps scope through a renamed errors dataField', async () => {
    const result = await run(
      schema({ dataName: 'value' }),
      `{ posts {
        a: wrapped { ... on PostWrappedSuccess { v: value { posts(published: 1) { id } } } }
        b: wrapped { ... on PostWrappedSuccess { v: value { posts(published: 0) { id } } } }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([{ a: { v: published }, b: { v: drafts } }]);
  });

  it('rejects a static function-form selection on a to-one relation when the schema is built', () => {
    const builder = createBuilder();
    builder.prismaObject('Post', {
      fields: (t) => ({
        label: t.string({
          select: { author: (author) => ({ rows: author.select('firstName') }) },
          resolve: () => 'unexpected',
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({ posts: t.prismaField({ type: ['Post'], resolve: () => db.orm.Post }) }),
    });
    expect(() => builder.toSchema()).toThrow(
      "select on 'Post.label': the function form of to-one relation 'author' requires combine()",
    );
  });

  it('rejects a count of a to-one relation before SQL', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', {
      fields: (t) => ({ authorCount: t.relationCount('author' as never) }),
    });
    builder.queryType({
      fields: (t) => ({ posts: t.prismaField({ type: ['Post'], resolve: () => db.orm.Post }) }),
    });
    const result = await run(builder.toSchema(), '{ posts { authorCount } }');
    expect(result.errors?.[0].message).toContain(
      'Function-form selection on to-one relation "author"',
    );
    expect(result.statements).toHaveLength(0);
  });
});
