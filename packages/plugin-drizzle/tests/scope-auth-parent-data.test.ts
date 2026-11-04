import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// scope-auth is listed first, so its wrapper runs outside the drizzle plugin's.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: {};
  AuthScopes: { ok: boolean };
}>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({ ok: true }) },
});

const seen: {
  type: unknown[];
  field: unknown[];
  typeWith: unknown[];
  impl: unknown[];
  iface: unknown[];
  excluded: unknown[];
  redacted: unknown[];
  conflict: unknown[];
} = {
  type: [],
  field: [],
  typeWith: [],
  impl: [],
  iface: [],
  excluded: [],
  redacted: [],
  conflict: [],
};

const User = builder.drizzleObject('users', {
  name: 'User',
  select: { columns: { id: true, username: true } },
  authScopes: (user) => {
    seen.type.push(user.username);
    return true;
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.string({
      nullable: true,
      select: { with: { profile: { columns: { bio: true } } } },
      authScopes: (user) => {
        seen.field.push(user.profile === undefined ? 'missing' : user.profile?.bio);
        return true;
      },
      resolve: (user) => user.profile?.bio ?? null,
    }),
    bioFromFunction: t.string({
      nullable: true,
      select: () => ({ with: { profile: { columns: { bio: true } } } }),
      authScopes: (user) => {
        seen.field.push(user.profile === undefined ? 'missing' : user.profile?.bio);
        return true;
      },
      resolve: (user) => user.profile?.bio ?? null,
    }),
  }),
});

const UserWithProfile = builder.drizzleObject('users', {
  variant: 'UserWithProfile',
  select: { with: { profile: true } },
  authScopes: (user) => {
    seen.typeWith.push(user.profile === undefined ? 'missing' : user.profile?.bio);
    return true;
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
  }),
});

const IfaceUser = builder.drizzleInterface('users', {
  variant: 'IfaceUser',
  select: { columns: { id: true } },
  resolveType: () => 'ImplUser',
  fields: (t) => ({
    ifaceId: t.exposeID('id'),
  }),
});

// scope-auth also runs the implementing type's authScopes on the field the interface declares.
const ImplUser = builder.drizzleObject('users', {
  variant: 'ImplUser',
  interfaces: [IfaceUser],
  select: { columns: { id: true }, with: { profile: { columns: { bio: true } } } },
  authScopes: (user) => {
    seen.impl.push(user.profile === undefined ? 'missing' : user.profile?.bio);
    return true;
  },
  fields: () => ({}),
});

// Allows only when the posts the type loads include a draft, which its filter never loads, so it
// always denies.
const PublishedAuthor = builder.drizzleObject('users', {
  variant: 'PublishedAuthor',
  select: { with: { posts: { where: { published: 1 } } } },
  authScopes: (author) => author.posts.some((post) => !post.published),
  fields: (t) => ({
    // Selects the author's posts without the type's filter.
    postCount: t.int({
      select: () => ({ with: { posts: true } }),
      resolve: (author) => author.posts.length,
    }),
  }),
});

// scope-auth runs the interface's authScopes on its implementation's fields too.
const ProfileIface = builder.drizzleInterface('users', {
  variant: 'ProfileIface',
  select: { with: { profile: { columns: { bio: true } } } },
  resolveType: () => 'NoProfileImpl',
  authScopes: (user) => {
    seen.iface.push(user.profile === undefined ? 'missing' : user.profile?.bio);
    return true;
  },
  fields: (t) => ({
    profileIfaceId: t.exposeID('id'),
  }),
});

const NoProfileImpl = builder.drizzleObject('users', {
  variant: 'NoProfileImpl',
  // @ts-expect-error The shape lacks the interface's select, which a row built by hand can too.
  interfaces: [ProfileIface],
  select: { columns: { id: true } },
  fields: () => ({}),
});

// Every column but `lastName`.
const ExcludingUser = builder.drizzleObject('users', {
  variant: 'ExcludingUser',
  select: { columns: { lastName: false } },
  authScopes: (user) => {
    seen.excluded.push(user.username);
    return true;
  },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const RedactedUser = builder.drizzleObject('users', {
  variant: 'RedactedUser',
  select: { columns: { username: true }, with: { profile: true } },
  authScopes: (user) => {
    seen.redacted.push(user.username);
    return true;
  },
  fields: (t) => ({
    username: t.string({ resolve: (user) => user.username }),
  }),
});

// The interface and its implementation filter the same relation differently.
const DraftsIface = builder.drizzleInterface('users', {
  variant: 'DraftsIface',
  select: { with: { posts: { where: { published: 0 } } } },
  resolveType: () => 'PublishedImpl',
  fields: (t) => ({
    draftsIfaceId: t.exposeID('id'),
  }),
});

const PublishedImpl = builder.drizzleObject('users', {
  variant: 'PublishedImpl',
  interfaces: [DraftsIface],
  select: { columns: { username: true }, with: { posts: { where: { published: 1 } } } },
  authScopes: (user) => {
    seen.conflict.push(user.posts.every((post) => post.published));
    return true;
  },
  fields: (t) => ({
    username: t.string({ resolve: (user) => user.username }),
  }),
});

builder.queryType({
  fields: (t) => ({
    redacted: t.field({
      type: RedactedUser,
      resolve: async () =>
        ({
          ...(await db.query.users.findFirst({ where: { id: 1 } })),
          username: 'redacted',
        }) as never,
    }),
    plainPublishedImpl: t.field({
      type: PublishedImpl,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }) as never,
    }),
    plainAuthor: t.field({
      type: PublishedAuthor,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }) as never,
    }),
    partialNoProfileImpl: t.field({
      type: NoProfileImpl,
      resolve: () => ({ id: 1 }) as never,
    }),
    partialExcluding: t.field({
      type: ExcludingUser,
      resolve: () => ({ id: 1 }) as never,
    }),
    planned: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })) as never,
    }),
    plain: t.field({
      type: User,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }) as never,
    }),
    partial: t.field({
      type: User,
      resolve: () => ({ id: 1 }) as never,
    }),
    implPlanned: t.drizzleField({
      type: ImplUser,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })) as never,
    }),
    implPlain: t.field({
      type: ImplUser,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }) as never,
    }),
    ifacePlanned: t.drizzleField({
      type: IfaceUser,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })) as never,
    }),
    plannedWithProfile: t.drizzleField({
      type: UserWithProfile,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })) as never,
    }),
    plainWithProfile: t.field({
      type: UserWithProfile,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }) as never,
    }),
  }),
});

const schema = builder.toSchema();

describe('authScopes see the parent data their types promise', () => {
  let user: { username: string; profile: { bio: string | null } | null };

  beforeAll(async () => {
    user = (await db.query.users.findFirst({ where: { id: 1 }, with: { profile: true } }))!;
  });

  beforeEach(() => {
    clearDrizzleLogs();
    seen.type = [];
    seen.field = [];
    seen.typeWith = [];
    seen.impl = [];
    seen.iface = [];
    seen.excluded = [];
    seen.redacted = [];
    seen.conflict = [];
  });

  it("a planned row has the field's select without a reload", async () => {
    const result = await execute({
      schema,
      document: gql`{ planned { id bio } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.field).toEqual([user.profile?.bio]);
    expect(seen.type).toEqual([user.username]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it("a field's select is loaded for its resolver, after authScopes run", async () => {
    const result = await execute({
      schema,
      document: gql`{ plain { id bio } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plain: { id: '1', bio: user.profile?.bio ?? null } });
    // The row has the type's select, so nothing is reloaded before the field's authScopes run.
    expect(seen.field).toEqual(['missing']);
    // The root query and one batched reload, as before.
    expect(drizzleLogs).toHaveLength(2);
  });

  it('a function select is planned, but not loaded before authScopes run', async () => {
    const planned = await execute({
      schema,
      document: gql`{ planned { bioFromFunction } }`,
      contextValue: {},
    });

    expect(planned.errors).toBeUndefined();
    expect(seen.field).toEqual([user.profile?.bio]);
    expect(drizzleLogs).toHaveLength(1);

    const plain = await execute({
      schema,
      document: gql`{ plain { bioFromFunction } }`,
      contextValue: {},
    });

    expect(plain.errors).toBeUndefined();
    expect(plain.data).toEqual({ plain: { bioFromFunction: user.profile?.bio ?? null } });
    expect(seen.field).toEqual([user.profile?.bio, 'missing']);
    expect(drizzleLogs).toHaveLength(3);
  });

  it("a row without the type's select columns is reloaded before type authScopes run", async () => {
    const result = await execute({
      schema,
      document: gql`{ partial { id } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.type).toEqual([user.username]);
    // The type's select, then the `id` field's own reload.
    expect(drizzleLogs).toHaveLength(2);
  });

  it("a planned row has the type's relations without a reload", async () => {
    const result = await execute({
      schema,
      document: gql`{ plannedWithProfile { id username } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.typeWith).toEqual([user.profile?.bio]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it("a row without the type's relations is reloaded once before type authScopes run", async () => {
    const result = await execute({
      schema,
      document: gql`{ plainWithProfile { id username } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plainWithProfile: { id: '1', username: user.username } });
    expect(seen.typeWith).toEqual([user.profile?.bio]);
    // The root query, one type-level reload shared by both fields, then their own batched reload.
    expect(drizzleLogs).toHaveLength(3);
  });

  it("an inherited field's row the plugin didn't load gets the implementing type's select", async () => {
    const plain = await execute({
      schema,
      document: gql`{ implPlain { ifaceId } }`,
      contextValue: {},
    });

    expect(plain.errors).toBeUndefined();
    expect(seen.impl).toEqual([user.profile?.bio]);
    // The root query, the type-level selections, then the field's own reload.
    expect(drizzleLogs).toHaveLength(3);

    seen.impl = [];
    clearDrizzleLogs();

    const planned = await execute({
      schema,
      document: gql`{ implPlanned { ifaceId } }`,
      contextValue: {},
    });

    expect(planned.errors).toBeUndefined();
    expect(seen.impl).toEqual([user.profile?.bio]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it('a row planned through the interface is not reloaded for the implementing type', async () => {
    const result = await execute({
      schema,
      document: gql`{ ifacePlanned { ifaceId } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    // The plan only walked the interface, so its row lacks the implementing type's select.
    expect(seen.impl).toEqual(['missing']);
    expect(drizzleLogs).toHaveLength(1);
  });
  it("a field's select doesn't replace the type's filtered relation its authScopes read", async () => {
    const result = await execute({
      schema,
      document: gql`{ plainAuthor { postCount } }`,
      contextValue: {},
    });

    expect(result.data).toEqual({ plainAuthor: { postCount: null } });
    expect(result.errors).toHaveLength(1);
  });

  it("an inherited field's row the plugin didn't load gets its interface's select", async () => {
    const result = await execute({
      schema,
      document: gql`{ partialNoProfileImpl { profileIfaceId } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.iface).toEqual([user.profile?.bio]);
  });

  it('a reload fills what the row is missing without replacing what it has', async () => {
    const result = await execute({
      schema,
      document: gql`{ redacted { username } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ redacted: { username: 'redacted' } });
    expect(seen.redacted).toEqual(['redacted']);
  });

  it("an interface whose select conflicts with its implementation's is left out of the reload", async () => {
    const result = await execute({
      schema,
      document: gql`{ plainPublishedImpl { username } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plainPublishedImpl: { username: user.username } });
    expect(seen.conflict).toEqual([true]);
  });

  it('a row without the columns an exclusion-only select keeps is reloaded', async () => {
    const result = await execute({
      schema,
      document: gql`{ partialExcluding { id } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.excluded).toEqual([user.username]);
    // The type's select, then the `id` field's own reload.
    expect(drizzleLogs).toHaveLength(2);
  });
});
