import { describe, expect, it } from 'vitest';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

describe("object fields reading an interface's select", () => {
  function withPosts(ownSelect: boolean) {
    const builder = createBuilder();
    const WithPosts = builder.prismaInterface('User', {
      variant: 'WithPosts',
      select: { posts: true },
      fields: (t) => ({ interfaceCount: t.int({ resolve: (user) => user.posts.length }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [WithPosts],
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
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
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

  // Selects that agree load into one slot, so every field reads the row itself, not a projection.
  it('gives fields the same row when interface and implementation select the same rows', async () => {
    const parents: Record<string, object[]> = { iface: [], own: [] };
    const builder = createBuilder();
    const Published = builder.prismaInterface('User', {
      variant: 'Published',
      select: { posts: { where: { published: 1 } } },
      fields: (t) => ({
        ifaceCount: t.int({
          resolve: (user) => {
            parents.iface.push(user);
            return user.posts.length;
          },
        }),
      }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Published],
      select: { posts: { where: { published: 1 } } },
      fields: (t) => ({
        ownCount: t.int({
          resolve: (user) => {
            parents.own.push(user);
            return user.posts.length;
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { ifaceCount ownCount } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { ifaceCount: 1, ownCount: 1 },
      { ifaceCount: 1, ownCount: 1 },
    ]);
    expect(parents.own).toHaveLength(2);
    expect(parents.own[0]).toBe(parents.iface[0]);
    expect(parents.own[1]).toBe(parents.iface[1]);
    expect(result.statements).toHaveLength(1);
  });

  it("reads the interface's computed values", async () => {
    const builder = createBuilder();
    const Totals = builder.prismaInterface('User', {
      variant: 'UserTotals',
      select: { total: { posts: (sub) => sub.count() } },
      fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Totals],
      fields: (t) => ({
        id: t.exposeID('id'),
        doubled: t.int({ resolve: (user) => user.total * 2 }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
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
      variant: 'NamedUser',
      select: ['firstName'],
      fields: (t) => ({ name: t.string({ resolve: (user) => user.firstName }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Named],
      fields: (t) => ({ shout: t.string({ resolve: (user) => user.firstName.toUpperCase() }) }),
    });
    builder.queryType({
      fields: (t) => ({
        // A cast row lacking the selected column, as the types otherwise reject.
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) as never }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { shout } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { shout: 'ALICE' } });
    expect(result.statements).toHaveLength(1);
  });

  it("loads an interface's columns and to-one relation with the object's selection", async () => {
    const builder = createBuilder();
    const Base = builder.prismaInterface('Post', {
      variant: 'PostBase',
      select: { content: true, author: true },
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
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
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
      { content: expect.any(String), baseAuthor: 'Alice', ownAuthor: 'Alice' },
    ]);
    expect(both.statements).toHaveLength(1);
  });
});
