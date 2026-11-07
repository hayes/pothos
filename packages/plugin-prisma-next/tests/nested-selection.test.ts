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
        posts: nestedSelection(() => (posts) => posts.orderBy((post) => post.id.desc()).limit(1)),
      }),
      resolve: (user) => user.posts,
    }),
    // The posts beneath a type without a model.
    previews: t.field({
      type: [PostPreview],
      select: (_args, _ctx, nestedSelection) => ({
        posts: nestedSelection({ orderBy: { id: 'asc' }, limit: 1 }, ['post']),
      }),
      resolve: (user) => user.posts,
    }),
    activity: t.field({
      type: [Activity],
      select: (_args, _ctx, nestedSelection) => ({
        // A ref, or a model's name for its default type.
        posts: nestedSelection({ orderBy: { id: 'asc' }, limit: 1 }, [], Post),
        comments: nestedSelection(true, [], 'Comment'),
      }),
      resolve: (user) => [...user.posts, ...user.comments],
    }),
  }));
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: [User],
        resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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
    // The views each comment's post has, counted beneath the comments.
    select: {
      comments: { select: { post: { select: { viewCount: { views: (sub) => sub.count() } } } } },
    },
    fields: (t) => ({
      email: t.exposeString('email'),
      viewsOfCommented: t.intList({
        resolve: (user) => user.comments.map((comment) => comment.post.viewCount),
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
        comments: { query: { orderBy: { id: 'asc' } }, select: { post: nestedSelection() } },
      }),
      resolve: (user) => user.comments.map((comment) => comment.post),
    }),
    // The posts as the type a ref names, beneath the comments.
    commentedAsPost: t.field({
      type: [Post],
      select: (_args, _ctx, nestedSelection) => ({
        comments: { select: { post: nestedSelection(true, [], Post) } },
      }),
      resolve: (user) => user.comments.map((comment) => comment.post),
    }),
    // A to-many relation beneath a to-one relation of the comments.
    discussion: t.field({
      type: [Comment],
      select: (_args, _ctx, nestedSelection) => ({
        comments: {
          select: { post: { select: { comments: nestedSelection({ orderBy: { id: 'asc' } }) } } },
        },
      }),
      resolve: (user) => user.comments.flatMap((comment) => comment.post.comments),
    }),
    // Filtered rows and a computed value beneath a static `select`.
    firstViewers: t.stringList({
      select: {
        comments: {
          query: { where: { body: 'Looks great!' } },
          select: {
            post: {
              select: {
                views: { orderBy: { viewer: 'asc' }, limit: 1 },
                commentCount: { comments: (sub) => sub.count() },
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
        resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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

  // Rows a nested select loads beneath are in a branch of their own, since a reader of the whole
  // relation may find rows loaded without what it names. So a whole include of the same relation
  // loads in a second branch of the same statement.
  it('loads a nested select beside a whole include of the relation, in one statement', async () => {
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
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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
    expect(result.statements[0]!.sql.match(/FROM "comment"/g)).toHaveLength(2);
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
