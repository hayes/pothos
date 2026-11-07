import { describe, expect, it } from 'vitest';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

function schema() {
  const builder = createBuilder<{ newest?: boolean }>();
  builder.prismaObject('User', {
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      posts: t.relation('posts', { query: { orderBy: { createdAt: 'asc' } } }),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({ title: t.exposeString('title'), author: t.relation('author') }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: ['User'] }),
      user: t.prismaField({
        type: 'User',
        nullable: true,
        args: { id: t.arg.id({ required: true }) },
        query: (args) => ({ where: { id: String(args.id) } }),
      }),
      secondPublished: t.prismaField({
        type: ['Post'],
        query: { where: { published: 1 }, orderBy: { createdAt: 'desc' }, limit: 1, offset: 1 },
      }),
      latestPost: t.prismaField({
        type: 'Post',
        query: { orderBy: { createdAt: 'desc' } },
      }),
      posts: t.prismaField({
        type: ['Post'],
        args: { published: t.arg.boolean() },
        query: (args, ctx) =>
          args.published == null
            ? undefined
            : {
                where: { published: args.published ? 1 : 0 },
                orderBy: { createdAt: ctx.newest ? 'desc' : 'asc' },
              },
      }),
      bobPosts: t.prismaField({
        type: ['Post'],
        args: { limit: t.arg.int({ required: true }) },
        collection: () => db.orm.Post.where({ authorId: 'u-bob' }),
        query: (args) => ({ orderBy: { createdAt: 'desc' }, limit: args.limit }),
      }),
      postPage: t.prismaConnection({ type: 'Post', query: { orderBy: { createdAt: 'asc' } } }),
    }),
  });
  return builder.toSchema();
}

describe('prismaField without collection', () => {
  const built = schema();

  it("loads a list from the type's collection", async () => {
    const result = await run(built, '{ users { firstName posts { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { firstName: 'Alice', posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }] },
      { firstName: 'Bob', posts: [{ title: 'Bob writes' }, { title: 'Bob draft' }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it("pages a connection of the type's collection", async () => {
    const result = await run(built, '{ postPage(first: 2) { edges { node { title } } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.postPage.edges).toEqual([
      { node: { title: 'Hello, Pothos' } },
      { node: { title: 'Draft #1' } },
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

describe('prismaField query', () => {
  const built = schema();

  it('looks up a row by the where a callback builds from the args', async () => {
    const result = await run(built, '{ user(id: "u-bob") { firstName posts { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({
      firstName: 'Bob',
      posts: [{ title: 'Bob writes' }, { title: 'Bob draft' }],
    });
    expect(result.statements).toHaveLength(1);

    const missing = await run(built, '{ user(id: "missing") { firstName } }');
    expect(missing.errors).toBeUndefined();
    expect(missing.data.user).toBeNull();
    expect(missing.statements).toHaveLength(1);
  });

  it('applies a literal where, orderBy, limit and offset', async () => {
    const result = await run(built, '{ secondPublished { title author { firstName } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.secondPublished).toEqual([
      { title: 'Hello, Pothos', author: { firstName: 'Alice' } },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('reads the first row of an ordered single-row field', async () => {
    const result = await run(built, '{ latestPost { title } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.latestPost).toEqual({ title: 'Bob draft' });
    expect(result.statements).toHaveLength(1);
  });

  it('applies what a callback returns for the args and context, and nothing for undefined', async () => {
    const drafts = await run(built, '{ posts(published: false) { title } }', {
      context: { newest: true },
    });
    expect(drafts.errors).toBeUndefined();
    expect(drafts.data.posts).toEqual([{ title: 'Bob draft' }, { title: 'Draft #1' }]);
    expect(drafts.statements).toHaveLength(1);

    const all = await run(built, '{ posts { title } }');
    expect(all.data.posts).toHaveLength(4);
    expect(all.statements).toHaveLength(1);
  });

  it('shapes the rows of a given collection', async () => {
    const result = await run(built, '{ bobPosts(limit: 1) { title } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.bobPosts).toEqual([{ title: 'Bob draft' }]);
    expect(result.statements).toHaveLength(1);
  });
});
