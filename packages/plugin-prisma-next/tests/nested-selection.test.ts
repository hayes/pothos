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
