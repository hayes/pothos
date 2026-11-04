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

const seen: { type: unknown[]; field: unknown[]; typeWith: unknown[]; impl: unknown[] } = {
  type: [],
  field: [],
  typeWith: [],
  impl: [],
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

builder.queryType({
  fields: (t) => ({
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

  it("a row the plugin didn't load is reloaded with the field's select before authScopes run", async () => {
    const result = await execute({
      schema,
      document: gql`{ plain { id bio } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plain: { id: '1', bio: user.profile?.bio ?? null } });
    expect(seen.field).toEqual([user.profile?.bio]);
    // The root query and one batched reload, as before.
    expect(drizzleLogs).toHaveLength(2);
  });

  it('a function select is loaded before authScopes run, planned or not', async () => {
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
    expect(seen.field).toEqual([user.profile?.bio, user.profile?.bio]);
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
    expect(drizzleLogs).toHaveLength(1);
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
    // The root query and one reload shared by both fields.
    expect(drizzleLogs).toHaveLength(2);
  });

  it("an inherited field's row the plugin didn't load gets the implementing type's select", async () => {
    const plain = await execute({
      schema,
      document: gql`{ implPlain { ifaceId } }`,
      contextValue: {},
    });

    expect(plain.errors).toBeUndefined();
    expect(seen.impl).toEqual([user.profile?.bio]);
    expect(drizzleLogs).toHaveLength(2);

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
});
