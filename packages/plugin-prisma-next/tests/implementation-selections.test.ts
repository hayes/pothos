import { describe, expect, it } from 'vitest';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

describe("an implementation's select under an interface", () => {
  it('loads the columns isTypeOf reads', async () => {
    const builder = createBuilder();
    const Person = builder.prismaInterface('User', {
      name: 'Person',
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.prismaObject('User', {
      variant: 'Alice',
      interfaces: [Person],
      select: ['email'],
      isTypeOf: (user) => user.email === 'alice@example.com',
    });
    builder.prismaObject('User', {
      variant: 'Other',
      interfaces: [Person],
      select: ['email'],
      isTypeOf: (user) => user.email !== undefined && user.email !== 'alice@example.com',
    });
    builder.queryType({
      fields: (t) => ({
        people: t.prismaField({
          type: [Person],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ people { __typename firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      people: [
        { __typename: 'Alice', firstName: 'Alice' },
        { __typename: 'Other', firstName: 'Bob' },
      ],
    });
    expect(result.statements).toHaveLength(1);
  });
});

describe("object fields reading an interface's select", () => {
  function withPosts(ownSelect: boolean) {
    const builder = createBuilder();
    const WithPosts = builder.prismaInterface('User', {
      name: 'WithPosts',
      select: { posts: true },
      fields: (t) => ({ interfaceCount: t.int({ resolve: (user) => user.posts.length }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [WithPosts],
      isTypeOf: () => true,
      ...(ownSelect ? { select: ['firstName'] } : {}),
      fields: (t) => ({
        id: t.exposeID('id'),
        ownCount: t.int({ resolve: (user) => user.posts.length }),
        published: t.relation('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
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

  it.each([
    false,
    true,
  ])("reads the interface's relation slot beside another consumer (own select: %s)", async (ownSelect) => {
    const result = await run(
      withPosts(ownSelect),
      '{ users { id ownCount interfaceCount published { id } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', ownCount: 2, interfaceCount: 2, published: [{ id: 'p-hello' }] },
      { id: 'u-bob', ownCount: 2, interfaceCount: 2, published: [expect.anything()] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it("reads the interface's computed values", async () => {
    const builder = createBuilder();
    const Totals = builder.prismaInterface('User', {
      name: 'UserTotals',
      select: { posts: (sub) => ({ total: sub.count() }) },
      fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Totals],
      isTypeOf: () => true,
      fields: (t) => ({
        id: t.exposeID('id'),
        doubled: t.int({ resolve: (user) => user.total * 2 }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { id doubled } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', doubled: 4 },
      { id: 'u-bob', doubled: 4 },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it("reloads a hand-built parent missing the interface's columns", async () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      name: 'NamedUser',
      select: ['firstName'],
      fields: (t) => ({ name: t.string({ resolve: (user) => user.firstName }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Named],
      isTypeOf: () => true,
      fields: (t) => ({ shout: t.string({ resolve: (user) => user.firstName.toUpperCase() }) }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) as never }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { shout } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { shout: 'ALICE' } });
    expect(result.statements).toHaveLength(1);
  });

  it("loads a conflicting interface's columns with the object's selection", async () => {
    const builder = createBuilder();
    const Base = builder.prismaInterface('Post', {
      name: 'PostBase',
      select: { content: true, author: { where: { firstName: 'Nobody' } } },
      fields: (t) => ({
        baseAuthor: t.string({ nullable: true, resolve: (post) => post.author?.firstName }),
      }),
    });
    builder.prismaObject('Post', {
      interfaces: [Base],
      select: { author: true },
      fields: (t) => ({
        id: t.exposeID('id'),
        content: t.string({ nullable: true, resolve: (post) => post.content }),
        ownAuthor: t.string({ nullable: true, resolve: (post) => post.author?.firstName }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    const schema = builder.toSchema();
    const result = await run(schema, '{ posts { id content ownAuthor } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      { id: 'p-hello', content: expect.any(String), ownAuthor: 'Alice' },
    ]);
    expect(result.statements).toHaveLength(1);

    const both = await run(schema, '{ posts { content baseAuthor ownAuthor } }');
    expect(both.errors).toBeUndefined();
    expect(both.data.posts).toEqual([
      { content: expect.any(String), baseAuthor: null, ownAuthor: 'Alice' },
    ]);
    expect(both.statements).toHaveLength(2);
  });
});
