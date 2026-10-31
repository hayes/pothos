import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

describe('prismaInterface', () => {
  function schema() {
    const builder = createBuilder();
    const User = builder.prismaInterface('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaInterfaceFields(User, (t) => ({ firstName: t.exposeString('firstName') }));
    builder.prismaInterfaceField(User, 'email', (t) => t.exposeString('email'));
    builder.prismaObject('User', {
      variant: 'Admin',
      interfaces: [User],
      select: ['firstName'],
      isTypeOf: (user) => user.firstName === 'Alice',
      fields: (t) => ({
        lastName: t.exposeString('lastName'),
        posts: t.relation('posts', { query: { orderBy: (post) => post.id.asc() } }),
      }),
    });
    builder.prismaObject('User', {
      variant: 'Regular',
      interfaces: [User],
      select: ['firstName'],
      isTypeOf: (user) => user.firstName !== 'Alice',
      fields: (t) => ({ email: t.exposeString('email') }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ id: t.exposeID('id'), author: t.relation('author') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: [User], resolve: () => db.orm.User }),
        user: t.prismaField({
          type: User,
          nullable: true,
          resolve: () => db.orm.User.where({ id: 'u-bob' }),
        }),
        userPage: t.prismaConnection({ type: User, cursor: 'id', resolve: () => db.orm.User }),
        post: t.prismaField({
          type: 'Post',
          resolve: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('declares interface fields and the objects implementing it', () => {
    const sdl = printSchema(schema());
    expect(sdl).toMatch(
      /interface User \{\n {2}email: String\n {2}firstName: String\n {2}id: ID\n\}/,
    );
    expect(sdl).toMatch(/type Admin implements User/);
    expect(sdl).toMatch(/author: User!/);
  });

  it('routes rows through isTypeOf, loading the columns it reads', async () => {
    const result = await run(
      schema(),
      `{
        users { __typename id ... on Admin { lastName posts { id } } ... on Regular { email } }
        user { email }
        userPage(first: 1) { nodes { id ... on Admin { posts { id } } } }
        post { author { firstName } }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        {
          __typename: 'Admin',
          id: 'u-alice',
          lastName: 'Andrews',
          posts: [{ id: 'p-draft1' }, { id: 'p-hello' }],
        },
        { __typename: 'Regular', id: 'u-bob', email: 'bob@example.com' },
      ],
      user: { email: 'bob@example.com' },
      userPage: { nodes: [{ id: 'u-alice', posts: [{ id: 'p-draft1' }, { id: 'p-hello' }] }] },
      post: { author: { firstName: 'Alice' } },
    });
  });

  it('routes rows through a resolveType the interface declares', async () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      name: 'Named',
      select: ['firstName'],
      resolveType: (user) => (user.firstName === 'Alice' ? 'Alice' : 'Other'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    for (const name of ['Alice', 'Other']) {
      builder.prismaObject('User', {
        variant: name,
        interfaces: [Named] as never,
        fields: () => ({}),
      });
    }
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: [Named], resolve: () => db.orm.User }) }),
    });
    const result = await run(builder.toSchema(), '{ users { __typename id } }');
    expect(result.data.users).toEqual([
      { __typename: 'Alice', id: 'u-alice' },
      { __typename: 'Other', id: 'u-bob' },
    ]);
  });

  it('merges fields into an interface variant through its ref', () => {
    const builder = createBuilder();
    const Base = builder.prismaInterface('User', {
      variant: 'UserBase',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaInterfaceFields(Base, (t) => ({ firstName: t.exposeString('firstName') }));
    builder.prismaObject('User', { interfaces: [Base], isTypeOf: () => true, fields: () => ({}) });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    const sdl = printSchema(builder.toSchema());
    expect(sdl).toMatch(/interface UserBase \{\n {2}firstName: String\n {2}id: ID\n\}/);
    expect(sdl).toMatch(/type User implements UserBase/);
  });

  it('lets a plain object type implementing the interface inherit its model', async () => {
    const builder = createBuilder();
    const Base = builder.prismaInterface('User', {
      variant: 'UserBase',
      fields: (t) => ({ firstName: t.exposeString('firstName'), posts: t.relation('posts') }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.objectType(builder.objectRef<{ id: string }>('PlainUser'), {
      interfaces: [Base as never],
      isTypeOf: () => true,
      fields: () => ({}),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: [Base], resolve: () => db.orm.User.where({ id: 'u-bob' }) }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { __typename ... on PlainUser { firstName posts { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        __typename: 'PlainUser',
        firstName: 'Bob',
        posts: [{ id: 'p-bob1' }, { id: 'p-bob-draft' }],
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('rejects an object implementing an interface of another model', () => {
    const builder = createBuilder();
    const PostLike = builder.prismaInterface('Post', {
      variant: 'PostLike',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      interfaces: [PostLike as never],
      isTypeOf: () => true,
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(
      /PrismaObjects must share a contract model with the PrismaInterfaces they extend/,
    );
  });
});

describe('inherited selections', () => {
  it('loads interface selections through concrete and interface roots', async () => {
    const builder = createBuilder();
    const Totals = builder.prismaInterface('User', {
      name: 'UserTotals',
      select: { posts: (sub) => ({ total: sub.count() }) },
      fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
    });
    const Published = builder.prismaInterface('User', {
      name: 'UserPublishedTotals',
      interfaces: [Totals] as never,
      select: { posts: (sub) => ({ published: sub.where({ published: 1 }).count() }) },
      fields: (t) => ({ published: t.int({ resolve: (user) => user.published }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Totals, Published] as never,
      isTypeOf: () => true,
      select: { posts: true },
      fields: (t) => ({
        id: t.exposeID('id'),
        ownTotal: t.int({ resolve: (user) => user.posts.length }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: [User], resolve: () => db.orm.User }),
        viaInterface: t.prismaField({ type: [Published], resolve: () => db.orm.User }),
        unplanned: t.field({
          type: [User],
          resolve: () => [{ id: 'u-alice' }, { id: 'u-bob' }] as never,
        }),
      }),
    });
    const users = [
      { id: 'u-alice', total: 2, published: 1, ownTotal: 2 },
      { id: 'u-bob', total: 2, published: 1, ownTotal: 2 },
    ];
    const result = await run(
      builder.toSchema(),
      `{
        users { id total published ownTotal }
        viaInterface { total published ... on User { id ownTotal } }
        unplanned { id total published ownTotal }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users,
      viaInterface: users,
      unplanned: users,
    });
  });

  it('loads interface prerequisites for fields without their own selection', async () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      name: 'NamedUser',
      select: ['firstName'],
      fields: (t) => ({ name: t.string({ resolve: (user) => user.firstName }) }),
    });
    const User = builder.prismaObject('User', { interfaces: [Named] as never });
    builder.queryType({
      fields: (t) => ({
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) as never }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { name } }');
    expect(result.data).toEqual({ user: { name: 'Alice' } });
    expect(result.statements).toHaveLength(1);
  });

  function conflicting() {
    const builder = createBuilder();
    const Base = builder.prismaInterface('Post', {
      name: 'PostBase',
      select: { author: { where: { firstName: 'Alice' } } },
      fields: (t) => ({
        baseAuthor: t.string({ nullable: true, resolve: (post) => post.author?.firstName }),
      }),
    });
    builder.prismaObject('Post', {
      interfaces: [Base],
      select: { author: { where: { firstName: 'Bob' } } },
      fields: (t) => ({
        ownAuthor: t.string({ nullable: true, resolve: (post) => post.author?.firstName }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.orderBy((post) => post.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('loads conflicting interface and object prerequisites in separate batches', async () => {
    const result = await run(conflicting(), '{ posts { baseAuthor ownAuthor } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      { baseAuthor: null, ownAuthor: 'Bob' },
      { baseAuthor: null, ownAuthor: 'Bob' },
      { baseAuthor: 'Alice', ownAuthor: null },
      { baseAuthor: 'Alice', ownAuthor: null },
    ]);
    expect(result.statements).toHaveLength(2);
  });
});
