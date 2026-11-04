import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin, { type ScopeAuthParentLoader } from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { GraphQLResolveInfo } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

const seen: { type: unknown[]; impl: unknown[] } = { type: [], impl: [] };

const bioOf = (user: { profile?: { bio: string | null } | null }) =>
  user.profile === undefined ? 'missing' : user.profile?.bio;

// scope-auth is listed first, and its type checks run from `isTypeOf`, before any field resolves.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: {};
  AuthScopes: { ok: boolean };
}>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType: true },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  select: { columns: { id: true }, with: { profile: { columns: { bio: true } } } },
  authScopes: (user) => {
    seen.type.push(bioOf(user));
    return true;
  },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const NoSelect = builder.drizzleObject('users', {
  variant: 'NoSelectUser',
  authScopes: () => true,
  fields: (t) => ({
    id: t.exposeID('id'),
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

builder.drizzleObject('users', {
  variant: 'ImplUser',
  interfaces: [IfaceUser],
  select: { columns: { id: true }, with: { profile: { columns: { bio: true } } } },
  authScopes: (user) => {
    seen.impl.push(bioOf(user));
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
    plainList: t.field({
      type: [User],
      resolve: () => db.query.users.findMany({ where: { id: { in: [1, 2] } } }) as never,
    }),
    noSelect: t.field({
      type: NoSelect,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }) as never,
    }),
    ifacePlanned: t.drizzleField({
      type: IfaceUser,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })) as never,
    }),
  }),
});

const schema = builder.toSchema();

describe('runScopesOnType checks see the type select', () => {
  let bios: Map<number, string | null | undefined>;

  beforeAll(async () => {
    const users = await db.query.users.findMany({
      where: { id: { in: [1, 2] } },
      with: { profile: true },
    });
    bios = new Map(users.map((user) => [user.id, user.profile?.bio]));
  });

  beforeEach(() => {
    clearDrizzleLogs();
    seen.type = [];
    seen.impl = [];
  });

  it('is set only for types with a type-level select, and only with ScopeAuthPlugin', () => {
    expect(schema.getType('User')?.extensions?.pothosScopeAuthParent).toBeTypeOf('function');
    expect(schema.getType('NoSelectUser')?.extensions).not.toHaveProperty('pothosScopeAuthParent');

    const plain = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
      plugins: [DrizzlePlugin],
      drizzle: { client: () => db, getTableConfig, relations },
      // Required by scope-auth's option types, which this file loads; unused without the plugin.
      scopeAuth: { authScopes: () => ({}) },
    });
    plain.drizzleObject('users', {
      name: 'User',
      select: { with: { profile: true } },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    plain.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

    expect(plain.toSchema().getType('User')?.extensions).not.toHaveProperty(
      'pothosScopeAuthParent',
    );
  });

  it('a planned row is checked as it is, without a reload', async () => {
    const result = await execute({ schema, document: gql`{ planned { id } }`, contextValue: {} });

    expect(result.errors).toBeUndefined();
    expect(seen.type).toEqual([bios.get(1)]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it('returns a complete row synchronously', () => {
    const load = schema.getType('User')?.extensions?.pothosScopeAuthParent as ScopeAuthParentLoader;
    const row = { id: 1, profile: null };

    expect(load(row, {}, {} as GraphQLResolveInfo)).toBe(row);
  });

  it("a row without the type's select is reloaded before the type's authScopes run", async () => {
    const result = await execute({ schema, document: gql`{ plain { id } }`, contextValue: {} });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plain: { id: '1' } });
    expect(seen.type).toEqual([bios.get(1)]);
    // The root query, the type check's reload, which the field's type-level check reuses, and the
    // field's own reload.
    expect(drizzleLogs).toHaveLength(3);
  });

  it('the rows of a list are reloaded in one batch', async () => {
    const result = await execute({
      schema,
      document: gql`{ plainList { id } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.type).toEqual([bios.get(1), bios.get(2)]);
    expect(drizzleLogs).toHaveLength(3);
  });

  it("a row planned through an interface is reloaded with the implementation's select", async () => {
    const result = await execute({
      schema,
      document: gql`{ ifacePlanned { ifaceId } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.impl).toEqual([bios.get(1)]);
  });
});
