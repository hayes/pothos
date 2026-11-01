import SchemaBuilder from '@pothos/core';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { createBuilder, run, useCollisionDb, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();
const collision = useCollisionDb();

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

  it('hands interface field builders the Interface kind', () => {
    const builder = createBuilder();
    const kinds: string[] = [];
    const User = builder.prismaInterface('User', {
      fields: (t) => {
        kinds.push(t.graphqlKind);
        return { id: t.exposeID('id') };
      },
    });
    builder.prismaInterfaceField(User, 'email', (t) => {
      kinds.push(t.graphqlKind);
      return t.exposeString('email');
    });
    builder.prismaObject('Post', {
      fields: (t) => {
        kinds.push(t.graphqlKind);
        return { id: t.exposeID('id') };
      },
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    builder.toSchema();
    expect(kinds.sort()).toEqual(['Interface', 'Interface', 'Object']);
  });

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
    // One per root field, each selecting the column isTypeOf reads.
    expect(result.statements).toHaveLength(4);
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
      "'User' is based on model 'User' but implements prismaInterface 'PostLike', based on " +
        "unrelated model 'Post'. A type can only implement prismaInterfaces of one model hierarchy.",
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
      interfaces: [Totals],
      select: { posts: (sub) => ({ published: sub.where({ published: 1 }).count() }) },
      fields: (t) => ({ published: t.int({ resolve: (user) => user.published }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Totals, Published],
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
          resolve: () => [{ id: 'u-alice' }, { id: 'u-bob' }],
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
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) }),
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

  it("hands isTypeOf and other resolvers the type select's rows when a field combines them", async () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      name: 'Named',
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    const isTypeOfSaw: unknown[] = [];
    builder.prismaObject('User', {
      interfaces: [Named],
      select: { posts: true },
      isTypeOf: (user) => {
        const posts: unknown = user.posts;
        isTypeOfSaw.push(
          Array.isArray(posts) ? posts.map((post: { title: string }) => post.title).sort() : posts,
        );
        return Array.isArray(posts);
      },
      fields: (t) => ({
        titles: t.stringList({ resolve: (user) => user.posts.map((post) => post.title).sort() }),
        published: t.relation('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    builder.queryType({
      fields: (t) => ({
        named: t.prismaField({
          type: [Named],
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ named { firstName ... on User { titles published { title } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      named: [
        {
          firstName: 'Alice',
          titles: ['Draft #1', 'Hello, Pothos'],
          published: [{ title: 'Hello, Pothos' }],
        },
      ],
    });
    // graphql-js calls isTypeOf to resolve the interface, then again to complete the object.
    expect(isTypeOfSaw.length).toBeGreaterThan(0);
    expect(new Set(isTypeOfSaw.map((titles) => JSON.stringify(titles)))).toEqual(
      new Set([JSON.stringify(['Draft #1', 'Hello, Pothos'])]),
    );
    expect(result.statements).toHaveLength(1);
  });

  it("hands each implementation's isTypeOf the rows its own select loads", async () => {
    const builder = createBuilder();
    const Person = builder.prismaInterface('User', {
      name: 'Person',
      select: { posts: { limit: 1 } },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      variant: 'Prolific',
      interfaces: [Person],
      select: { posts: true },
      isTypeOf: (user) => user.posts.length >= 2,
    });
    builder.prismaObject('User', {
      variant: 'Quiet',
      interfaces: [Person],
      select: { posts: true },
      isTypeOf: (user) => user.posts.length < 2,
    });
    builder.queryType({
      fields: (t) => ({
        people: t.prismaField({
          type: [Person],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ people { __typename id } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.people).toEqual([
      { __typename: 'Prolific', id: 'u-alice' },
      { __typename: 'Prolific', id: 'u-bob' },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  function ownerBuilder() {
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: collision.client },
    });
    const Account = builder.prismaInterface('Owner', {
      name: 'Account',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('Profile', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        accounts: t.prismaField({
          type: [Account],
          resolve: () => collision.orm.Owner.orderBy((owner) => owner.id.asc()),
        }),
      }),
    });
    return { builder, Account };
  }

  it("loads an implementation's to-one select for isTypeOf through the interface", async () => {
    const { builder, Account } = ownerBuilder();
    builder.prismaObject('Owner', {
      variant: 'WithProfile',
      interfaces: [Account],
      select: { profile: true },
      isTypeOf: (owner) => owner.profile !== null,
    });
    builder.prismaObject('Owner', {
      variant: 'WithoutProfile',
      interfaces: [Account],
      select: { profile: true },
      isTypeOf: (owner) => owner.profile === null,
    });
    const result = await run(builder.toSchema(), '{ accounts { __typename id } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.accounts).toEqual([
      { __typename: 'WithProfile', id: '1' },
      { __typename: 'WithoutProfile', id: '2' },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('rejects implementations that load a to-one relation differently', () => {
    const { builder, Account } = ownerBuilder();
    builder.prismaObject('Owner', {
      variant: 'WithProfile',
      interfaces: [Account],
      select: { profile: true },
    });
    builder.prismaObject('Owner', {
      variant: 'WithoutProfile',
      interfaces: [Account],
      select: { profile: { where: { id: 1 } } },
    });
    expect(() => builder.toSchema()).toThrow(
      `The select of 'WithoutProfile' loads to-one relation "profile" differently`,
    );
  });
});
