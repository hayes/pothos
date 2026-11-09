import SchemaBuilder from '@pothos/core';
import type { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import PrismaNextPlugin, { type PlannedRowBrand } from '../src';
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
        posts: t.relation('posts', { query: { orderBy: { id: 'asc' } } }),
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
        users: t.prismaField({ type: [User], collection: () => db.orm.User }),
        user: t.prismaField({
          type: User,
          nullable: true,
          collection: () => db.orm.User.where({ id: 'u-bob' }),
        }),
        userPage: t.prismaConnection({ type: User, collection: () => db.orm.User }),
        post: t.prismaField({
          type: 'Post',
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
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
    expect(sdl).toMatch(/author: User\n/);
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
      fields: (t) => ({ users: t.prismaField({ type: [Named], collection: () => db.orm.User }) }),
    });
    const result = await run(builder.toSchema(), '{ users { __typename id } }');
    expect(result.data.users).toEqual([
      { __typename: 'Alice', id: 'u-alice' },
      { __typename: 'Other', id: 'u-bob' },
    ]);
  });

  it("reloads what an interface's resolveType reads when the returned row lacks it", async () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      select: ['firstName'],
      resolveType: (user) => (user.firstName === 'Alice' ? 'Alice' : 'Other'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    for (const name of ['Alice', 'Other']) {
      builder.prismaObject('User', { variant: name, interfaces: [Named], fields: () => ({}) });
    }
    const Plain = builder.prismaObject('User', {
      variant: 'Plain',
      fields: (t) => ({
        id: t.exposeID('id'),
        // A plain field plans nothing, so the row it returns holds only what its parent loaded.
        self: t.field({ type: Named, resolve: (user) => user as never }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [Plain],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { self { __typename id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { self: { __typename: 'Alice', id: 'u-alice' } },
      { self: { __typename: 'Other', id: 'u-bob' } },
    ]);
    // The users, a batch reloading both rows as the interface for resolveType, and one reloading
    // them as their types for `id`.
    expect(result.statements).toHaveLength(3);
  });

  it("doesn't reload the to-many relations of an interface's select for resolveType", async () => {
    const builder = createBuilder();
    const Posting = builder.prismaInterface('User', {
      variant: 'Posting',
      select: { posts: true },
      resolveType: () => 'Poster',
      fields: (t) => ({ postCount: t.int({ resolve: (user) => user.posts.length }) }),
    });
    builder.prismaObject('User', { variant: 'Poster', interfaces: [Posting], fields: () => ({}) });
    const Plain = builder.prismaObject('User', {
      variant: 'Plain',
      fields: (t) => ({ self: t.field({ type: Posting, resolve: (user) => user as never }) }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [Plain],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const schema = builder.toSchema();
    const typename = await run(schema, '{ users { self { __typename } } }');
    expect(typename.errors).toBeUndefined();
    expect(typename.data.users).toEqual([
      { self: { __typename: 'Poster' } },
      { self: { __typename: 'Poster' } },
    ]);
    expect(typename.statements).toHaveLength(1);
    // A field reading them still reloads the rows.
    const counts = await run(schema, '{ users { self { postCount } } }');
    expect(counts.errors).toBeUndefined();
    expect(counts.data.users).toEqual([{ self: { postCount: 2 } }, { self: { postCount: 2 } }]);
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
    builder.objectType(builder.objectRef<{ id: string } & PlannedRowBrand<'User'>>('PlainUser'), {
      interfaces: [Base],
      isTypeOf: () => true,
      fields: () => ({}),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [Base],
          collection: () => db.orm.User.where({ id: 'u-bob' }),
        }),
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
      select: { posts: true },
      fields: (t) => ({ total: t.int({ resolve: (user) => user.posts.length }) }),
    });
    const Published = builder.prismaInterface('User', {
      variant: 'UserPublishedTotals',
      interfaces: [Totals],
      resolveType: () => 'User',
      select: { comments: true },
      fields: (t) => ({ published: t.int({ resolve: (user) => user.comments.length }) }),
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
        users: t.prismaField({ type: [User], collection: () => db.orm.User }),
        viaInterface: t.prismaField({ type: [Published], collection: () => db.orm.User }),
        unplanned: t.field({
          type: [User],
          // @ts-expect-error a row built by hand isn't planned; it reloads
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
          collection: () => db.orm.User.where({ id: 'u-alice' }),
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

  it("loads a to-one select for resolveType and an implementation's fields through the interface", async () => {
    const builder = new SchemaBuilder<{ PrismaContract: typeof collision.contract }>({
      plugins: [PrismaNextPlugin],
      prisma: { client: collision.client },
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
          collection: () => collision.orm.Owner.orderBy((owner) => owner.id.asc()),
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

  it('agrees with selects that write a nested relation as true and as {}', () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      select: { posts: { select: { comments: true } } },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      variant: 'Viewer',
      select: { posts: { select: { comments: {} } } },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });

  // A row holds one version of a relation, which the fields and auth checks of every type of its
  // model read, so their selects can't load it differently.
  describe('rejects selects of one model that define a key differently', () => {
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
        "'Named' and 'User' both select 'posts', with different definitions. Every row of " +
          "model 'User' holds one value for it, which the fields and auth checks of every type " +
          "of the model read. Define it the same way in both, or load the other version in a field's select.",
      );
    });

    it('on two implementations of one interface', () => {
      const builder = createBuilder();
      const Person = builder.prismaInterface('User', {
        variant: 'Person',
        resolveType: () => 'Prolific',
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.prismaObject('User', {
        variant: 'Prolific',
        interfaces: [Person],
        select: { posts: true },
      });
      builder.prismaObject('User', {
        variant: 'Quiet',
        interfaces: [Person],
        select: { posts: { where: { published: 0 } } },
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Prolific' and 'Quiet' both select 'posts', with different definitions.",
      );
    });

    it('on unrelated types of one model', () => {
      const builder = createBuilder();
      builder.prismaObject('User', {
        select: { posts: { limit: 1 } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.prismaObject('User', {
        variant: 'Viewer',
        select: { posts: { limit: 2 } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'User' and 'Viewer' both select 'posts', with different definitions.",
      );
    });

    it('with an orderBy listing its columns in another order', () => {
      const builder = createBuilder();
      builder.prismaObject('User', {
        select: { posts: { orderBy: { id: 'asc', createdAt: 'asc' }, limit: 1 } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.prismaObject('User', {
        variant: 'Viewer',
        select: { posts: { orderBy: { createdAt: 'asc', id: 'asc' }, limit: 1 } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'User' and 'Viewer' both select 'posts', with different definitions.",
      );
    });

    it('with orderBy selectors, which compare by identity', () => {
      const build = (other: boolean) => {
        const builder = createBuilder();
        type PostColumns = { id: { asc(): OrderByItem } };
        const byId = (post: PostColumns) => post.id.asc();
        builder.prismaObject('User', {
          select: { posts: { orderBy: byId } },
          fields: (t) => ({ id: t.exposeID('id') }),
        });
        builder.prismaObject('User', {
          variant: 'Viewer',
          select: { posts: { orderBy: other ? (post: PostColumns) => post.id.asc() : byId } },
          fields: (t) => ({ id: t.exposeID('id') }),
        });
        builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
        return () => builder.toSchema();
      };
      expect(build(false)).not.toThrow();
      expect(build(true)).toThrow(
        "'User' and 'Viewer' both select 'posts', with different definitions.",
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
        "'Base' and 'Post' both select 'comments', with different definitions.",
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
        "'Base' and 'Derived' both select 'comments', with different definitions.",
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
        "'Published' and 'Drafting' both select 'posts', with different definitions.",
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
        "'Named' and 'User' both select 'posts', with different definitions.",
      );
    });

    it('with nested selects that differ', () => {
      const builder = createBuilder();
      const Named = builder.prismaInterface('User', {
        variant: 'Named',
        select: { posts: { where: { published: 1 }, select: { comments: true } } },
        fields: () => ({}),
      });
      builder.prismaObject('User', {
        interfaces: [Named],
        select: { posts: { where: { published: 1 }, select: { author: true } } },
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Named' and 'User' both select 'posts', with different definitions.",
      );
    });

    it('with a variant type and the base type', () => {
      const builder = createBuilder();
      const Named = builder.prismaInterface('User', {
        variant: 'Named',
        select: { posts: { select: { title: true } } },
        fields: () => ({}),
      });
      builder.prismaObject('User', {
        interfaces: [Named],
        select: { posts: { select: ['title'] } },
      });
      builder.prismaObject('User', {
        variant: 'Other',
        interfaces: [Named],
        select: { posts: { where: { published: 1 } } },
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Named' and 'Other' both select 'posts', with different definitions.",
      );
    });

    it('with where functions that are not the same function', () => {
      const builder = createBuilder();
      const Named = builder.prismaInterface('User', {
        variant: 'Named',
        select: { posts: { where: (post) => post.published.eq(1) } },
        fields: () => ({}),
      });
      builder.prismaObject('User', {
        interfaces: [Named],
        select: { posts: { where: (post) => post.published.eq(1) } },
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      expect(() => builder.toSchema()).toThrow(
        "'Named' and 'User' both select 'posts', with different definitions.",
      );
    });
  });

  it('lets sibling implementations select different relations', () => {
    const builder = createBuilder();
    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      select: ['email'],
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
      select: { comments: { limit: 1 } },
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });

  // Equal definitions, written apart, share one load.
  it('reads what the selects of a type and its interface define alike', async () => {
    const builder = createBuilder();
    const Counted = builder.prismaInterface('User', {
      variant: 'Counted',
      select: { posts: { where: { published: 0 }, select: { comments: true } } },
      resolveType: () => 'User',
      fields: (t) => ({
        id: t.exposeID('id'),
        total: t.int({ resolve: (user) => user.posts[0]!.comments.length }),
      }),
    });
    const User = builder.prismaObject('User', {
      interfaces: [Counted],
      select: { posts: { where: { published: 0 }, select: { comments: true } }, firstName: true },
      fields: (t) => ({
        own: t.int({ resolve: (user) => user.posts[0]!.comments.length }),
        drafts: t.int({ resolve: (user) => user.posts.length }),
        firstName: t.exposeString('firstName'),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: User, collection: () => db.orm.User.where({ id: 'u-alice' }) }),
        counted: t.prismaField({
          type: Counted,
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const schema = builder.toSchema();
    for (const [query, data] of [
      [
        '{ user { total own drafts firstName } }',
        { user: { total: 0, own: 0, drafts: 1, firstName: 'Alice' } },
      ],
      [
        '{ counted { total ... on User { own drafts } } }',
        { counted: { total: 0, own: 0, drafts: 1 } },
      ],
    ] as const) {
      const result = await run(schema, query);
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(data);
      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].sql.match(/FROM "post"/g)).toHaveLength(1);
    }
  });

  it('lets sibling implementations compute the same key alike', async () => {
    const builder = createBuilder();
    const Person = builder.prismaInterface('User', {
      variant: 'Person',
      resolveType: (user) => (user.id === 'u-alice' ? 'All' : 'Published'),
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    for (const variant of ['All', 'Published'] as const) {
      builder.prismaObject('User', {
        variant,
        interfaces: [Person],
        select: { posts: { where: { published: 1 } } },
        fields: (t) => ({ count: t.int({ resolve: (user) => user.posts.length }) }),
      });
    }
    builder.queryType({
      fields: (t) => ({
        people: t.prismaField({
          type: [Person],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ people { __typename ... on All { count } ... on Published { count } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.people).toEqual([
      { __typename: 'All', count: 1 },
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
        comments: { where: {}, orderBy: {} },
      },
      fields: (t) => ({
        ownIds: t.idList({ resolve: (user) => user.posts.map((post) => post.id) }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        named: t.prismaField({
          type: [Named],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
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
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
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
        count: t.relationCount('posts', { query: { where: { published: 0 } } }),
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
          collection: () => db.orm.User.where({ id: 'u-alice' }),
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
        post: t.prismaField({
          type: 'Post',
          collection: () => db.orm.Post.where({ id: 'p-bob1' }),
        }),
        user: t.prismaField({ type: 'User', collection: () => db.orm.User.where({ id: 'u-bob' }) }),
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
