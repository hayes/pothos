import SchemaBuilder from '@pothos/core';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  createBuilder,
  deferSchema,
  run,
  runIncremental,
  useCollisionDb,
  useSampleDb,
} from './fixtures/helpers';

const db = useSampleDb();
const collision = useCollisionDb();

describe('prismaInterface', () => {
  function schema() {
    const builder = createBuilder();
    const User = builder.prismaInterface('User', {
      select: ['firstName'],
      resolveType: (user) => (user.firstName === 'Alice' ? 'Admin' : 'Regular'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaInterfaceFields(User, (t) => ({ firstName: t.exposeString('firstName') }));
    builder.prismaInterfaceField(User, 'email', (t) => t.exposeString('email'));
    builder.prismaObject('User', {
      variant: 'Admin',
      interfaces: [User],
      fields: (t) => ({
        lastName: t.exposeString('lastName'),
        posts: t.relation('posts', { query: { orderBy: (post) => post.id.asc() } }),
      }),
    });
    builder.prismaObject('User', {
      variant: 'Regular',
      interfaces: [User],
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
        userPage: t.prismaConnection({ type: User, resolve: () => db.orm.User }),
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

  it('routes rows through resolveType, loading the columns it reads', async () => {
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
    // One per root field, each selecting the column resolveType reads.
    expect(result.statements).toHaveLength(4);
  });

  it('routes rows through a resolveType the interface declares', async () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      select: ['firstName'],
      resolveType: (user) => (user.firstName === 'Alice' ? 'Alice' : 'Other'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    for (const name of ['Alice', 'Other']) {
      builder.prismaObject('User', {
        variant: name,
        interfaces: [Named],
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
    builder.prismaObject('User', { interfaces: [Base], fields: () => ({}) });
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
      interfaces: [Base],
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
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(
      "'User' is of model 'User' but implements prismaInterface 'PostLike' of model 'Post'. " +
        "A type can only implement the prismaInterfaces of its model and of its model's root.",
    );
  });
});

describe('inherited selections', () => {
  it('loads interface selections through concrete and interface roots', async () => {
    const builder = createBuilder();
    const Totals = builder.prismaInterface('User', {
      variant: 'UserTotals',
      select: { posts: (sub) => ({ total: sub.count() }) },
      fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
    });
    const Published = builder.prismaInterface('User', {
      variant: 'UserPublishedTotals',
      interfaces: [Totals],
      resolveType: () => 'User',
      select: { posts: (sub) => ({ published: sub.where({ published: 1 }).count() }) },
      fields: (t) => ({ published: t.int({ resolve: (user) => user.published }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Totals, Published],
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
      variant: 'NamedUser',
      select: ['firstName'],
      fields: (t) => ({ name: t.string({ resolve: (user) => user.firstName }) }),
    });
    const User = builder.prismaObject('User', { interfaces: [Named] });
    builder.queryType({
      fields: (t) => ({
        // A cast row lacking the selected column, as the types otherwise reject.
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) as never }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { name } }');
    expect(result.data).toEqual({ user: { name: 'Alice' } });
    expect(result.statements).toHaveLength(1);
  });

  it("hands resolveType and other resolvers the type select's rows when a field combines them", async () => {
    const builder = createBuilder();
    const resolveTypeSaw: string[][] = [];
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      select: { posts: true },
      resolveType: (user) => {
        // Typed without to-many relations, which a row a resolver built needn't hold. This row
        // was planned, so it holds the select's.
        const { posts } = user as typeof user & { posts: { title: string }[] };
        resolveTypeSaw.push(posts.map((post) => post.title).sort());
        return 'User';
      },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.prismaObject('User', {
      interfaces: [Named],
      select: { posts: true },
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
    expect(resolveTypeSaw).toEqual([['Draft #1', 'Hello, Pothos']]);
    expect(result.statements).toHaveLength(1);
  });

  // Each implementation's fields read the rows its own select loads, all through the one statement
  // of the interface root.
  it("hands each implementation's fields the rows its own select loads", async () => {
    const builder = createBuilder();
    const Person = builder.prismaInterface('User', {
      variant: 'Person',
      resolveType: (user) => (user.id === 'u-alice' ? 'Prolific' : 'Quiet'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      variant: 'Prolific',
      interfaces: [Person],
      select: { posts: true },
      fields: (t) => ({ total: t.int({ resolve: (user) => user.posts.length }) }),
    });
    builder.prismaObject('User', {
      variant: 'Quiet',
      interfaces: [Person],
      select: { posts: { where: { published: 0 } } },
      fields: (t) => ({
        drafts: t.idList({ resolve: (user) => user.posts.map((post) => post.id) }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        people: t.prismaField({
          type: [Person],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ people { __typename id ... on Prolific { total } ... on Quiet { drafts } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.people).toEqual([
      { __typename: 'Prolific', id: 'u-alice', total: 2 },
      { __typename: 'Quiet', id: 'u-bob', drafts: ['p-bob-draft'] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it("loads a to-one select for resolveType and an implementation's fields through the interface", async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: collision.client },
    });
    const Account = builder.prismaInterface('Owner', {
      variant: 'Account',
      select: { profile: true },
      resolveType: (owner) => (owner.profile === null ? 'WithoutProfile' : 'WithProfile'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('Profile', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Owner', {
      variant: 'WithProfile',
      interfaces: [Account],
      select: { profile: true },
      fields: (t) => ({
        profileId: t.id({ nullable: true, resolve: (owner) => owner.profile?.id }),
      }),
    });
    builder.prismaObject('Owner', { variant: 'WithoutProfile', interfaces: [Account] });
    builder.queryType({
      fields: (t) => ({
        accounts: t.prismaField({
          type: [Account],
          resolve: () => collision.orm.Owner.orderBy((owner) => owner.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ accounts { __typename id ... on WithProfile { profileId } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.accounts).toEqual([
      { __typename: 'WithProfile', id: '1', profileId: expect.anything() },
      { __typename: 'WithoutProfile', id: '2' },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  // The interface `Filtered` extends, and the type's list naming `Filtered` first, once made a
  // lookup of `one` find `Filtered`'s filtered author, depending on how the two interfaces sort.
  describe.each([
    ['PostBase', 'Filtered'],
    ['Zed', 'Abc'],
  ])('a three-level hierarchy of %s and %s', (baseName, derivedName) => {
    function threeLevels() {
      const builder = createBuilder();
      const Base = builder.prismaInterface('Post', {
        variant: baseName,
        select: { author: true },
        fields: (t) => ({
          one: t.string({ nullable: true, resolve: (post) => post.author.firstName }),
        }),
      });
      const Derived = builder.prismaInterface('Post', {
        variant: derivedName,
        interfaces: [Base],
        fields: (t) => ({
          three: t.string({
            nullable: true,
            select: { author: { where: { firstName: 'Nobody' } } },
            resolve: (post) => post.author?.firstName,
          }),
        }),
      });
      const Post = builder.prismaObject('Post', {
        interfaces: [Derived, Base],
      });
      builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.queryType({
        fields: (t) => ({
          r: t.prismaField({ type: [Post], resolve: () => db.orm.Post.where({ id: 'p-hello' }) }),
        }),
      });
      return builder.toSchema();
    }

    it("reads the base interface's unfiltered author", async () => {
      const result = await run(threeLevels(), '{ r { one } }');
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ r: [{ one: 'Alice' }] });
      expect(result.statements).toHaveLength(1);
    });

    it("gives a field's filter its own load", async () => {
      const result = await run(threeLevels(), '{ r { one three } }');
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ r: [{ one: 'Alice', three: null }] });
      expect(result.statements).toHaveLength(2);
    });
  });

  // A row holds one version of a relation, which the fields and auth checks of its type and of its
  // interfaces all read, so their selects can't load it differently.
  describe('rejects selects of one row that load a relation differently', () => {
    it('on an interface and its implementation', () => {
      const builder = createBuilder();
      const Named = builder.prismaInterface('User', {
        variant: 'Named',
        select: { posts: { where: { published: 1 } } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.prismaObject('User', { interfaces: [Named], select: { posts: true } });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Named' and 'User' both select relation 'posts', with different arguments. A row of " +
          "'User' holds one version of the relation, which the fields and auth checks of both " +
          'types read. Select it with the same arguments in both, sharing any function such as ' +
          "an orderBy, or load the other version in a field, with t.relation('posts', { query }) " +
          "or a field's select.",
      );
    });

    it('on an interface its implementation reaches through another', () => {
      const builder = createBuilder();
      const Base = builder.prismaInterface('Post', {
        variant: 'Base',
        select: { comments: { limit: 1 } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      const Derived = builder.prismaInterface('Post', {
        variant: 'Derived',
        interfaces: [Base],
        fields: () => ({}),
      });
      builder.prismaObject('Post', {
        interfaces: [Derived, Base],
        select: { comments: { limit: 2 } },
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Base' and 'Post' both select relation 'comments', with different arguments.",
      );
    });

    it('on an interface and the interface extending it', () => {
      const builder = createBuilder();
      const Base = builder.prismaInterface('Post', {
        variant: 'Base',
        select: { comments: true },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.prismaInterface('Post', {
        variant: 'Derived',
        interfaces: [Base],
        select: { comments: { limit: 1 } },
        fields: () => ({}),
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Base' and 'Derived' both select relation 'comments', with different arguments.",
      );
    });

    it('on two interfaces of one type', () => {
      const builder = createBuilder();
      const Published = builder.prismaInterface('User', {
        variant: 'Published',
        select: { posts: { where: { published: 1 } } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      const Drafting = builder.prismaInterface('User', {
        variant: 'Drafting',
        select: { posts: { where: { published: 0 } } },
        fields: () => ({}),
      });
      builder.prismaObject('User', { interfaces: [Published, Drafting] });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Published' and 'Drafting' both select relation 'posts', with different arguments.",
      );
    });

    it('on an interface and a node implementing it', () => {
      const builder = createBuilder();
      const Named = builder.prismaInterface('User', {
        variant: 'Named',
        select: { posts: { limit: 1 } },
        fields: () => ({}),
      });
      builder.prismaNode('User', {
        id: { field: 'id' },
        interfaces: [Named],
        select: { posts: { limit: 2 } },
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Named' and 'User' both select relation 'posts', with different arguments.",
      );
    });

    it('with orderBy functions that are not the same function', () => {
      const builder = createBuilder();
      const Named = builder.prismaInterface('User', {
        variant: 'Named',
        select: { posts: { orderBy: (post) => post.id.asc() } },
        fields: () => ({}),
      });
      builder.prismaObject('User', {
        interfaces: [Named],
        select: { posts: { orderBy: (post) => post.id.asc() } },
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Named' and 'User' both select relation 'posts', with different arguments.",
      );
    });
  });

  it("lets a type read a relation function's values its interface selects", async () => {
    const builder = createBuilder();
    const Counted = builder.prismaInterface('User', {
      variant: 'Counted',
      select: { posts: (sub) => ({ total: sub.count() }) },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Counted],
      fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: User, resolve: () => db.orm.User.where({ id: 'u-alice' }) }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { total } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { total: 2 } });
  });

  // Implementations of one interface are different types, so each row is one of them and reads
  // its own type's version. Function entries compute values rather than load rows.
  it('lets sibling implementations, and function entries, select a relation differently', () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      select: { posts: (sub) => ({ total: sub.count() }) },
      fields: () => ({}),
    });
    builder.prismaObject('User', {
      variant: 'A',
      interfaces: [Named],
      select: { posts: { limit: 1 } },
    });
    builder.prismaObject('User', {
      variant: 'B',
      interfaces: [Named],
      select: { posts: (sub) => ({ published: sub.where({ published: 1 }).count() }) },
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });

  it("gives an implementation's computed key precedence over its interface's", async () => {
    const builder = createBuilder();
    const Counted = builder.prismaInterface('User', {
      variant: 'Counted',
      select: { posts: (sub) => ({ total: sub.count() }) },
      resolveType: () => 'User',
      fields: (t) => ({ counted: t.int({ resolve: (user) => user.total }) }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Counted],
      select: { posts: (sub) => ({ total: sub.where({ published: 1 }).count() }) },
      fields: (t) => ({ total: t.int({ resolve: (user) => user.total }) }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: User, resolve: () => db.orm.User.where({ id: 'u-alice' }) }),
        counted: t.prismaField({
          type: Counted,
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const schema = builder.toSchema();
    // Alice has two posts, one published.
    for (const query of [
      '{ user { counted total } }',
      '{ user: counted { counted ... on User { total } } }',
    ]) {
      const result = await run(schema, query);
      expect(result.errors).toBeUndefined();
      expect(result.data.user).toEqual({ counted: 1, total: 1 });
    }
  });

  it('lets sibling implementations compute the same key', async () => {
    const builder = createBuilder();
    const Person = builder.prismaInterface('User', {
      variant: 'Person',
      resolveType: (user) => (user.id === 'u-alice' ? 'All' : 'Published'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    for (const [variant, where] of [
      ['All', {}],
      ['Published', { published: 1 }],
    ] as const) {
      builder.prismaObject('User', {
        variant,
        interfaces: [Person],
        select: { posts: (sub) => ({ count: sub.where(where).count() }) },
        fields: (t) => ({ count: t.int({ resolve: (user) => user.count }) }),
      });
    }
    builder.queryType({
      fields: (t) => ({
        people: t.prismaField({
          type: [Person],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ people { __typename ... on All { count } ... on Published { count } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.people).toEqual([
      { __typename: 'All', count: 2 },
      { __typename: 'Published', count: 1 },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('reads a relation the selects of a type and its interface load alike', async () => {
    const builder = createBuilder();
    const query = { where: { published: 1 } };
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      select: { posts: query, comments: true },
      resolveType: () => 'User',
      fields: (t) => ({
        interfaceIds: t.idList({ resolve: (user) => user.posts.map((post) => post.id) }),
        comments: t.int({ resolve: (user) => user.comments.length }),
      }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Named],
      // An undefined option, and an empty where or orderBy, load the same rows.
      select: {
        posts: { where: { published: 1 }, limit: undefined },
        comments: { where: {}, orderBy: [] },
      },
      fields: (t) => ({
        ownIds: t.idList({ resolve: (user) => user.posts.map((post) => post.id) }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        named: t.prismaField({
          type: [Named],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { interfaceIds ownIds comments } named { interfaceIds comments ... on User { ownIds } } }',
    );
    expect(result.errors).toBeUndefined();
    const users = [
      { interfaceIds: ['p-hello'], ownIds: ['p-hello'], comments: 1 },
      { interfaceIds: ['p-bob1'], ownIds: ['p-bob1'], comments: 1 },
    ];
    expect(result.data).toEqual({ users, named: users });
    expect(result.statements).toHaveLength(2);
  });

  // An interface field without a select of its own is still planned on the interface, so the
  // implementation it resolves on finds the plan that loaded its row instead of reloading it.
  it('plans an interface field without a select for an implementation with a select', async () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      resolveType: () => 'User',
      fields: (t) => ({ label: t.string({ resolve: () => 'named' }) }),
    });
    builder.prismaObject('User', {
      interfaces: [Named],
      select: { posts: { where: { published: 1 } } },
      fields: (t) => ({ published: t.int({ resolve: (user) => user.posts.length }) }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        named: t.prismaField({
          type: [Named],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ named { label } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.named).toEqual([{ label: 'named' }, { label: 'named' }]);
    expect(result.statements).toHaveLength(1);
  });
});

// A reloaded row has slots of its own, and a mapping other than the one looked up for the row the
// field had. Its helpers read the reloaded row's slots at the position the reload planned them.
describe("field helpers on a reloaded parent's slots", () => {
  function reloadSchema() {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      resolveType: () => 'User',
      fields: (t) => ({
        published: t.relation('posts', { query: { where: { published: 1 } } }),
        count: t.relationCount('posts', { where: { published: 0 } }),
        drafts: t.idList({
          select: { posts: { where: { published: 0 } } },
          resolve: (user) => user.posts.map((post) => post.id),
        }),
      }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Named],
      select: { posts: true },
      fields: (t) => ({
        total: t.int({ resolve: (user) => user.posts.length }),
        own: t.relation('posts', { query: { where: { published: 0 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        named: t.field({ type: Named, resolve: () => ({ id: 'u-alice' }) as never }),
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) as never }),
        users: t.prismaField({
          type: [Named],
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    return builder;
  }

  const expected = {
    published: [{ id: 'p-hello' }],
    count: 1,
    drafts: ['p-draft1'],
    total: 2,
    own: [{ id: 'p-draft1' }],
  };
  const selection = 'published { id } count drafts ... on User { total own { id } }';

  it.each([
    'named',
    'user',
  ])('reads the slots of a hand-built %s parent once reloaded', async (root) => {
    const result = await run(reloadSchema().toSchema(), `{ ${root} { ${selection} } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data[root]).toEqual(expected);
  });

  it('reads the slots of a parent reloaded for a deferred fragment', async () => {
    const result = await runIncremental(
      deferSchema(reloadSchema()),
      `{ users { ... @defer { ${selection} } } }`,
    );
    expect([...result.patchErrors, ...result.completedErrors]).toEqual([]);
    expect(result.patches).toEqual([expected]);
  });
});

describe('relations typed as an interface', () => {
  function schema() {
    const builder = createBuilder();
    const NamedUser = builder.prismaInterface('User', {
      variant: 'NamedUser',
      select: ['firstName'],
      resolveType: () => 'NamedUserImpl',
      fields: (t) => ({ name: t.string({ resolve: (user) => user.firstName }) }),
    });
    builder.prismaObject('User', {
      variant: 'NamedUserImpl',
      interfaces: [NamedUser],
      fields: (t) => ({ email: t.exposeString('email') }),
    });
    const Titled = builder.prismaInterface('Post', {
      variant: 'Titled',
      resolveType: () => 'TitledPost',
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('Post', {
      variant: 'TitledPost',
      interfaces: [Titled],
      fields: () => ({}),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author', { type: NamedUser }) }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', { type: Titled }),
        page: t.relatedConnection('posts', { type: Titled }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({ type: 'Post', resolve: () => db.orm.Post.where({ id: 'p-bob1' }) }),
        user: t.prismaField({ type: 'User', resolve: () => db.orm.User.where({ id: 'u-bob' }) }),
      }),
    });
    return builder.toSchema();
  }

  it('loads a to-one relation typed as an interface', async () => {
    const result = await run(
      schema(),
      '{ post { author { name ... on NamedUserImpl { email } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.post.author).toEqual({ name: 'Bob', email: 'bob@example.com' });
    expect(result.statements).toHaveLength(1);
  });

  it('loads a to-many relation and a related connection typed as an interface', async () => {
    const result = await run(
      schema(),
      '{ user { posts { title } page(first: 1) { edges { node { title } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.user.posts).toContainEqual({ title: 'Bob writes' });
    expect(result.data.user.page.edges).toHaveLength(1);
    expect(result.statements).toHaveLength(1);
  });
});
