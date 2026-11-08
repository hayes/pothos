import { describe, expect, it } from 'vitest';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

function schema() {
  const builder = createBuilder();
  const User = builder.prismaObject('User', {
    fields: (t) => ({ email: t.exposeString('email') }),
  });
  const Post = builder.prismaObject('Post', {
    fields: (t) => ({
      title: t.exposeString('title'),
      writer: t.field({
        type: User,
        select: (_args, _ctx, nestedSelection) => ({ author: nestedSelection() }),
        resolve: (post) => post.author,
      }),
    }),
  });
  const Comment = builder.prismaObject('Comment', {
    fields: (t) => ({
      body: t.exposeString('body'),
      writer: t.relation('author'),
    }),
  });
  const PostPreview = builder.objectRef<{ id: string }>('PostPreview').implement({
    fields: (t) => ({
      post: t.field({ type: Post, resolve: (post) => post as never }),
      // Only what the selection beneath `post` planned is loaded.
      planned: t.stringList({ resolve: (post) => Object.keys(post).sort() }),
    }),
  });
  const Activity = builder.unionType('Activity', {
    types: [Post, Comment],
    resolveType: (row) => ('title' in row ? 'Post' : 'Comment'),
  });
  builder.prismaObjectFields(User, (t) => ({
    // Posts, through a field that isn't `t.relation`.
    picked: t.field({
      type: [Post],
      args: { published: t.arg.int({ required: true }) },
      select: (args, _ctx, nestedSelection) => ({
        posts: nestedSelection({ where: { published: args.published }, orderBy: { id: 'asc' } }),
      }),
      resolve: (user) => user.posts,
    }),
    latest: t.field({
      type: [Post],
      select: (_args, _ctx, nestedSelection) => ({
        posts: nestedSelection({ orderBy: { id: 'desc' }, limit: 1 }),
      }),
      resolve: (user) => user.posts,
    }),
    // The posts beneath a type without a model.
    previews: t.field({
      type: [PostPreview],
      select: (_args, _ctx, nestedSelection) => ({
        posts: nestedSelection({ orderBy: { id: 'asc' }, limit: 1, path: ['post'] }),
      }),
      resolve: (user) => user.posts,
    }),
    activity: t.field({
      type: [Activity],
      select: (_args, _ctx, nestedSelection) => ({
        // A ref, or a model's name for its default type.
        posts: nestedSelection({ orderBy: { id: 'asc' }, limit: 1, type: Post }),
        comments: nestedSelection({ type: 'Comment' }),
      }),
      resolve: (user) => [...user.posts, ...user.comments],
    }),
  }));
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: [User],
        collection: () => db.orm.User.orderBy((user) => user.id.asc()),
      }),
    }),
  });
  return builder.toSchema();
}

describe('nestedSelection', () => {
  it('plans the rows of each alias with its own args, in one statement for every parent', async () => {
    const result = await run(
      schema(),
      `{ users {
        a: picked(published: 1) { title writer { email } }
        b: picked(published: 0) { title }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        a: [{ title: 'Hello, Pothos', writer: { email: 'alice@example.com' } }],
        b: [{ title: 'Draft #1' }],
      },
      {
        a: [{ title: 'Bob writes', writer: { email: 'bob@example.com' } }],
        b: [{ title: 'Bob draft' }],
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('shares one branch between aliases with equal args', async () => {
    const result = await run(schema(), '{ users { latest { title } again: latest { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { latest: [{ title: 'Hello, Pothos' }], again: [{ title: 'Hello, Pothos' }] },
      { latest: [{ title: 'Bob writes' }], again: [{ title: 'Bob writes' }] },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.sql.match(/FROM "post"/g)).toHaveLength(1);
  });

  it('plans the same relation nested beneath itself', async () => {
    const result = await run(
      schema(),
      `{ users {
        picked(published: 1) { writer { picked(published: 0) { title } } }
        drafts: picked(published: 0) { writer { picked(published: 1) { title } } }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        picked: [{ writer: { picked: [{ title: 'Draft #1' }] } }],
        drafts: [{ writer: { picked: [{ title: 'Hello, Pothos' }] } }],
      },
      {
        picked: [{ writer: { picked: [{ title: 'Bob draft' }] } }],
        drafts: [{ writer: { picked: [{ title: 'Bob writes' }] } }],
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('plans the selection at a path beneath the field', async () => {
    const result = await run(
      schema(),
      '{ users { previews { planned post { title writer { email } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        previews: [
          {
            planned: ['author', 'id', 'title'],
            post: { title: 'Draft #1', writer: { email: 'alice@example.com' } },
          },
        ],
      },
      {
        previews: [
          {
            planned: ['author', 'id', 'title'],
            post: { title: 'Bob draft', writer: { email: 'bob@example.com' } },
          },
        ],
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('plans the selection as the type it names', async () => {
    const result = await run(
      schema(),
      `{ users { activity {
        ... on Post { title writer { email } }
        ... on Comment { body writer { email } }
      } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        activity: [
          { title: 'Draft #1', writer: { email: 'alice@example.com' } },
          { body: 'Glad to see this working.', writer: { email: 'alice@example.com' } },
        ],
      },
      {
        activity: [
          { title: 'Bob draft', writer: { email: 'bob@example.com' } },
          { body: 'Looks great!', writer: { email: 'bob@example.com' } },
        ],
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

function nestedSelectSchema() {
  const builder = createBuilder();
  const User = builder.prismaObject('User', {
    // The views of each comment's post, beneath the comments.
    select: { comments: { select: { post: { select: { views: true } } } } },
    fields: (t) => ({
      email: t.exposeString('email'),
      viewsOfCommented: t.intList({
        resolve: (user) => user.comments.map((comment) => comment.post.views.length),
      }),
    }),
  });
  const Post = builder.prismaObject('Post', {
    fields: (t) => ({
      title: t.exposeString('title'),
      writer: t.relation('author'),
    }),
  });
  const Comment = builder.prismaObject('Comment', {
    fields: (t) => ({
      body: t.exposeString('body'),
      writer: t.relation('author'),
    }),
  });
  builder.prismaObjectFields(User, (t) => ({
    // Through the comments, a join model of users and posts, to the posts they're on.
    commentedPosts: t.field({
      type: [Post],
      select: (_args, _ctx, nestedSelection) => ({
        comments: { orderBy: { id: 'asc' }, select: { post: nestedSelection() } },
      }),
      resolve: (user) => user.comments.map((comment) => comment.post),
    }),
    // The posts as the type a ref names, beneath the comments.
    commentedAsPost: t.field({
      type: [Post],
      select: (_args, _ctx, nestedSelection) => ({
        comments: { select: { post: nestedSelection({ type: Post }) } },
      }),
      resolve: (user) => user.comments.map((comment) => comment.post),
    }),
    // A to-many relation beneath a to-one relation of the comments.
    discussion: t.field({
      type: [Comment],
      select: (_args, _ctx, nestedSelection) => ({
        comments: {
          select: {
            post: { select: { comments: nestedSelection({ orderBy: { id: 'asc' } }) } },
          },
        },
      }),
      resolve: (user) => user.comments.flatMap((comment) => comment.post.comments),
    }),
    // Filtered rows and a computed value beneath a static `select`.
    firstViewers: t.stringList({
      select: {
        comments: {
          where: { body: 'Looks great!' },
          select: {
            post: {
              select: {
                views: { orderBy: { viewer: 'asc' }, limit: 1 },
                comments: (comments) => ({ commentCount: comments.count() }),
              },
            },
          },
        },
      },
      resolve: (user) =>
        user.comments.map(
          (comment) =>
            `${comment.body}: ${comment.post.views.map((view) => view.viewer)} of ${comment.post.commentCount}`,
        ),
    }),
  }));
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: [User],
        collection: () => db.orm.User.orderBy((user) => user.id.asc()),
      }),
    }),
  });
  return builder;
}

describe('nested select', () => {
  it('plans the rows of a relation through a join model in one statement', async () => {
    const result = await run(
      nestedSelectSchema().toSchema(),
      '{ users { email commentedPosts { title writer { email } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        email: 'alice@example.com',
        commentedPosts: [{ title: 'Hello, Pothos', writer: { email: 'alice@example.com' } }],
      },
      {
        email: 'bob@example.com',
        commentedPosts: [{ title: 'Hello, Pothos', writer: { email: 'alice@example.com' } }],
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('plans a to-many relation beneath a to-one relation of the rows', async () => {
    const result = await run(
      nestedSelectSchema().toSchema(),
      '{ users { discussion { body writer { email } } } }',
    );
    expect(result.errors).toBeUndefined();
    const discussion = [
      { body: 'Looks great!', writer: { email: 'bob@example.com' } },
      { body: 'Glad to see this working.', writer: { email: 'alice@example.com' } },
    ];
    expect(result.data.users).toEqual([{ discussion }, { discussion }]);
    expect(result.statements).toHaveLength(1);
  });

  it('loads what nested selects of a type and a field name, each for its own reader', async () => {
    const result = await run(
      nestedSelectSchema().toSchema(),
      '{ users { email viewsOfCommented firstViewers } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { email: 'alice@example.com', viewsOfCommented: [2], firstViewers: [] },
      {
        email: 'bob@example.com',
        viewsOfCommented: [2],
        firstViewers: ['Looks great!: Bob of 2'],
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('plans the rows beneath a nested select as the type a ref names', async () => {
    const result = await run(
      nestedSelectSchema().toSchema(),
      '{ users { commentedAsPost { title writer { email } } } }',
    );
    expect(result.errors).toBeUndefined();
    const commentedAsPost = [{ title: 'Hello, Pothos', writer: { email: 'alice@example.com' } }];
    expect(result.data.users).toEqual([{ commentedAsPost }, { commentedAsPost }]);
    expect(result.statements).toHaveLength(1);
  });

  // Entries with the same query share one include, holding what each nested select names.
  it('merges a nested select into a whole include of the relation', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        bodies: t.stringList({
          select: { comments: true },
          resolve: (user) => user.comments.map((comment) => comment.body),
        }),
        titles: t.stringList({
          select: { comments: { select: { post: true } } },
          resolve: (user) => user.comments.map((comment) => comment.post.title),
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
    const result = await run(builder.toSchema(), '{ users { bodies titles } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { bodies: ['Glad to see this working.'], titles: ['Hello, Pothos'] },
      { bodies: ['Looks great!'], titles: ['Hello, Pothos'] },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.sql.match(/FROM "comment"/g)).toHaveLength(1);
  });

  it("requires the nested selects of a model's types to agree", () => {
    const builder = nestedSelectSchema();
    builder.prismaObject('User', {
      variant: 'OtherUser',
      select: { comments: { select: { post: true } } },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    expect(() => builder.toSchema()).toThrow(
      "'User' and 'OtherUser' both select 'comments', with different definitions.",
    );
  });
});

// A relation entry's branch is identified by what it loads: its query and the variant it narrows
// to. Entries that load alike share one branch, with everything planned beneath them merged in.
describe('merging relation entries', () => {
  function mergeSchema() {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({ email: t.exposeString('email') }),
    });
    const Post = builder.prismaObject('Post', {
      // The type's own entry, which a field's planned rows merge with.
      select: { author: { select: { email: true } } },
      fields: (t) => ({
        id: t.exposeID('id'),
        writer: t.string({ resolve: (post) => post.author.email }),
        comments: t.relation('comments'),
        // Three entries of one to-one relation, which load in one include.
        authorEmail: t.string({ select: { author: true }, resolve: (post) => post.author.email }),
        authorPosts: t.int({
          select: { author: { select: { posts: true } } },
          resolve: (post) => post.author.posts.length,
        }),
        planned: t.field({
          type: User,
          select: (_args, _ctx, nestedSelection) => ({ author: nestedSelection() }),
          resolve: (post) => post.author,
        }),
      }),
    });
    builder.prismaObject('Comment', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObjectFields(User, (t) => ({
      drafts: t.idList({
        select: { posts: { where: { published: 0 }, select: { comments: true } } },
        resolve: (user) => user.posts.map((post) => `${post.id}:${post.comments.length}`),
      }),
      // The same entry, written apart.
      sameDrafts: t.idList({
        select: { posts: { where: { published: 0 }, select: { comments: true } } },
        resolve: (user) => user.posts.map((post) => `${post.id}:${post.comments.length}`),
      }),
      published: t.idList({
        select: { posts: { where: { published: 1 } } },
        resolve: (user) => user.posts.map((post) => post.id),
      }),
      byFlag: t.idList({
        args: { published: t.arg.int({ required: true }) },
        // A new callback on every call, identified by the field and its args.
        select: (args) => ({ posts: { where: (post) => post.published.eq(args.published) } }),
        resolve: (user) => user.posts.map((post) => post.id),
      }),
      posts: t.field({
        type: [Post],
        select: (_args, _ctx, nestedSelection) => ({
          posts: nestedSelection({ orderBy: { id: 'asc' } }),
        }),
        resolve: (user) => user.posts,
      }),
    }));
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        posts: t.prismaField({
          type: [Post],
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  const subqueries = (sql: string, table: string) =>
    sql.match(new RegExp(`FROM "${table}"`, 'g'))?.length ?? 0;

  it('shares one branch between aliases and fragments with equal entries', async () => {
    const result = await run(
      mergeSchema(),
      `{ users { a: drafts b: drafts ...One ...Two } }
      fragment One on User { drafts }
      fragment Two on User { sameDrafts }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { a: ['p-draft1:0'], b: ['p-draft1:0'], drafts: ['p-draft1:0'], sameDrafts: ['p-draft1:0'] },
      {
        a: ['p-bob-draft:0'],
        b: ['p-bob-draft:0'],
        drafts: ['p-bob-draft:0'],
        sameDrafts: ['p-bob-draft:0'],
      },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(subqueries(result.statements[0]!.sql, 'post')).toBe(1);
    expect(subqueries(result.statements[0]!.sql, 'comment')).toBe(1);
  });

  it("shares one branch between aliases whose select function's callback is equal", async () => {
    const result = await run(
      mergeSchema(),
      '{ users { a: byFlag(published: 1) b: byFlag(published: 1) } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { a: ['p-hello'], b: ['p-hello'] },
      { a: ['p-bob1'], b: ['p-bob1'] },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(subqueries(result.statements[0]!.sql, 'post')).toBe(1);
  });

  it('loads entries with different queries in branches of one statement', async () => {
    const result = await run(
      mergeSchema(),
      '{ users { drafts published a: byFlag(published: 1) b: byFlag(published: 0) } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { drafts: ['p-draft1:0'], published: ['p-hello'], a: ['p-hello'], b: ['p-draft1'] },
      { drafts: ['p-bob-draft:0'], published: ['p-bob1'], a: ['p-bob1'], b: ['p-bob-draft'] },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(subqueries(result.statements[0]!.sql, 'post')).toBe(4);
  });

  it("merges a field's planned rows with the type's entry of the relation", async () => {
    const result = await run(mergeSchema(), '{ users { posts { id writer comments { id } } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        posts: [
          {
            id: 'p-draft1',
            writer: 'alice@example.com',
            comments: [],
          },
          {
            id: 'p-hello',
            writer: 'alice@example.com',
            comments: [{ id: 'c-1' }, { id: 'c-2' }],
          },
        ],
      },
      {
        posts: [
          { id: 'p-bob-draft', writer: 'bob@example.com', comments: [] },
          { id: 'p-bob1', writer: 'bob@example.com', comments: [] },
        ],
      },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(subqueries(result.statements[0]!.sql, 'post')).toBe(1);
    expect(subqueries(result.statements[0]!.sql, 'comment')).toBe(1);
  });

  it("merges a type's entry with a field's nestedSelection of the relation", async () => {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ id: t.exposeID('id'), comments: t.relation('comments') }),
    });
    builder.prismaObject('Comment', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      select: { posts: { select: { author: true } } },
      fields: (t) => ({
        authors: t.stringList({
          resolve: (user) => user.posts.map((post) => post.author.email),
        }),
        posts: t.field({
          type: [Post],
          select: (_args, _ctx, nestedSelection) => ({ posts: nestedSelection() }),
          resolve: (user) => user.posts,
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
    const result = await run(builder.toSchema(), '{ user { authors posts { comments { id } } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({
      authors: ['alice@example.com', 'alice@example.com'],
      posts: expect.arrayContaining([
        { comments: [] },
        { comments: [{ id: 'c-1' }, { id: 'c-2' }] },
      ]),
    });
    expect(result.statements).toHaveLength(1);
    const { sql } = result.statements[0]!;
    expect(subqueries(sql, 'post')).toBe(1);
    expect(subqueries(sql, 'user')).toBe(2);
    expect(subqueries(sql, 'comment')).toBe(1);
  });

  it('loads the entries of a to-one relation in one include', async () => {
    const result = await run(
      mergeSchema(),
      '{ posts { writer authorEmail authorPosts planned { email drafts } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      {
        writer: 'alice@example.com',
        authorEmail: 'alice@example.com',
        authorPosts: 2,
        planned: { email: 'alice@example.com', drafts: ['p-draft1:0'] },
      },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(subqueries(result.statements[0]!.sql, 'user')).toBe(1);
  });
});
