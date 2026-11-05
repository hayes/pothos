import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { graphql, parse, subscribe } from 'graphql';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

const seen: unknown[] = [];
const bioOf = (user: { profile?: { bio: string | null } | null }) =>
  user.profile === undefined ? 'missing' : user.profile?.bio;

function createSchema(scopeAuthFirst: boolean, runScopesOnType: boolean) {
  const builder = new SchemaBuilder<{
    DrizzleRelations: DrizzleRelations;
    Context: {};
    AuthScopes: { ok: boolean };
  }>({
    plugins: scopeAuthFirst ? [ScopeAuthPlugin, DrizzlePlugin] : [DrizzlePlugin, ScopeAuthPlugin],
    drizzle: { client: () => db, getTableConfig, relations },
    scopeAuth: { authScopes: () => ({ ok: true }), runScopesOnType },
  });

  const User = builder.drizzleObject('users', {
    name: 'User',
    select: { columns: { id: true, username: true } },
    authScopes: (user) => {
      seen.push(user.username);
      return true;
    },
    fields: (t) => ({
      id: t.id({ resolve: (user) => user.id }),
      username: t.string({ nullable: true, resolve: (user) => user.username }),
    }),
  });

  const UserWithProfile = builder.drizzleObject('users', {
    variant: 'UserWithProfile',
    select: {
      columns: { id: true, username: true },
      with: { profile: { columns: { bio: true } } },
    },
    fields: (t) => ({
      username: t.string({ nullable: true, resolve: (user) => user.username }),
      bio: t.string({
        nullable: true,
        authScopes: (user) => {
          seen.push([user.username, bioOf(user)]);
          return true;
        },
        resolve: (user) => user.profile?.bio,
      }),
    }),
  });

  const IfaceUser = builder.drizzleInterface('users', {
    variant: 'IfaceUser',
    select: { columns: { id: true } },
    resolveType: () => 'ImplUser',
    fields: (t) => ({
      ifaceId: t.id({
        authScopes: (user) => {
          seen.push(bioOf(user as { profile?: { bio: string | null } | null }));
          return true;
        },
        resolve: (user) => user.id,
      }),
    }),
  });

  builder.drizzleObject('users', {
    variant: 'ImplUser',
    interfaces: [IfaceUser],
    select: { columns: { id: true }, with: { profile: { columns: { bio: true } } } },
    fields: () => ({}),
  });

  // Its `columns` only excludes, so it selects every other column.
  const NamedUser = builder.drizzleObject('users', {
    variant: 'NamedUser',
    select: { columns: { lastName: false } },
    authScopes: (user) => {
      seen.push(user.username);
      return true;
    },
    fields: (t) => ({
      id: t.id({ resolve: (user) => user.id }),
    }),
  });

  const UncheckedUser = builder.drizzleObject('users', {
    variant: 'UncheckedUser',
    select: { columns: { id: true, username: true } },
    fields: (t) => ({
      username: t.string({ nullable: true, resolve: (user) => user.username }),
    }),
  });

  // Returned by every mutation, which run one after the other.
  const sharedRow = { id: 1 };

  // Mutated between subscription events, each of which also gets it as the root value.
  const eventRow = { id: 1 };

  builder.subscriptionType({
    fields: (t) => ({
      userEvents: t.field({
        type: User,
        subscribe: async function* () {
          for (const id of [1, 2]) {
            eventRow.id = id;
            yield await Promise.resolve(eventRow);
          }
        },
        resolve: (row) => row as never,
      }),
    }),
  });

  builder.mutationType({
    fields: (t) => ({
      touch: t.field({ type: User, resolve: () => sharedRow as never }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      // Plain fields returning rows the plugin didn't load.
      partialUser: t.field({ type: User, resolve: () => ({ id: 1 }) as never }),
      partialUsers: t.field({ type: [User], resolve: () => [{ id: 1 }, { id: 2 }] as never }),
      completeUser: t.field({
        type: User,
        resolve: () => ({ id: 1, username: 'complete' }) as never,
      }),
      missingUser: t.field({
        type: User,
        nullable: true,
        resolve: () => ({ id: 999_999 }) as never,
      }),
      redactedUser: t.field({
        type: UserWithProfile,
        resolve: () => ({ id: 1, username: 'redacted' }) as never,
      }),
      partialProfileUser: t.field({
        type: UserWithProfile,
        resolve: () => ({ id: 1, profile: {} }) as never,
      }),
      partialIfaceUser: t.field({ type: IfaceUser, resolve: () => ({ id: 1 }) as never }),
      namedUser: t.field({ type: NamedUser, resolve: () => ({ id: 1 }) as never }),
      uncheckedUser: t.field({ type: UncheckedUser, resolve: () => ({ id: 1 }) as never }),
      user: t.drizzleField({
        type: User,
        resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })) as never,
      }),
    }),
  });

  return builder.toSchema();
}

const user1 = await db.query.users.findFirst({ where: { id: 1 }, with: { profile: true } });
const user2 = await db.query.users.findFirst({ where: { id: 2 } });

beforeEach(() => {
  seen.length = 0;
  clearDrizzleLogs();
});

describe.each([
  [true, false],
  [false, false],
  [true, true],
  [false, true],
])('drizzle rows the plugin did not load (scope-auth first: %s, runScopesOnType: %s)', (scopeAuthFirst, runScopesOnType) => {
  const schema = createSchema(scopeAuthFirst, runScopesOnType);
  const run = (source: string) => graphql({ schema, source, contextValue: {} });

  it("passes type authScopes the row with the type's select, and resolvers the original", async () => {
    const result = await run('{ partialUser { id username } }');

    expect(result).toEqual({ data: { partialUser: { id: '1', username: null } } });
    expect(seen).toEqual([user1!.username]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it("passes field authScopes the type's select, with loaded values replacing the row's", async () => {
    const result = await run('{ redactedUser { username bio } }');

    expect(result).toEqual({ data: { redactedUser: { username: 'redacted', bio: null } } });
    expect(seen).toEqual([[user1!.username, user1!.profile!.bio]]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it('replaces a partial relation with the loaded one', async () => {
    const result = await run('{ partialProfileUser { bio } }');

    expect(result.errors).toBeUndefined();
    expect(seen).toEqual([[user1!.username, user1!.profile!.bio]]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it('reloads the columns a select that only excludes columns selects', async () => {
    const result = await run('{ namedUser { id } }');

    expect(result).toEqual({ data: { namedUser: { id: '1' } } });
    expect(seen).toEqual([user1!.username]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it("uses the implementing type's select for a field the interface declares", async () => {
    const result = await run('{ partialIfaceUser { ifaceId } }');

    expect(result).toEqual({ data: { partialIfaceUser: { ifaceId: '1' } } });
    expect(seen).toEqual([user1!.profile!.bio]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it('reloads the rows of a list in one statement', async () => {
    const result = await run('{ partialUsers { username } }');

    expect(result.errors).toBeUndefined();
    expect(seen).toEqual([user1!.username, user2!.username]);
    expect(drizzleLogs).toHaveLength(1);
  });

  it('does not reload a row with the type select, or one the plugin loaded', async () => {
    const result = await run('{ completeUser { username } user { username } }');

    expect(result).toEqual({
      data: { completeUser: { username: 'complete' }, user: { username: user1!.username } },
    });
    expect(drizzleLogs).toHaveLength(1);
  });

  it('does not reload without checks', async () => {
    const result = await run('{ uncheckedUser { username } }');

    expect(result).toEqual({ data: { uncheckedUser: { username: null } } });
    expect(drizzleLogs).toHaveLength(0);
  });

  it('fails with a generic error when the reload fails', async () => {
    const result = await run('{ missingUser { username } }');

    expect(result.errors?.map((error) => error.message)).toEqual(['Unexpected error.']);
    expect((result.errors?.[0].originalError as Error).cause).toBeInstanceOf(Error);
  });

  it('reloads a row again for each root field', async () => {
    const result = await run('mutation { a: touch { id } b: touch { id } }');

    expect(result.errors).toBeUndefined();
    expect(drizzleLogs).toHaveLength(2);
  });

  it('reloads a row again for each subscription event', async () => {
    const events = await subscribe({
      schema,
      document: parse('subscription { userEvents { id } }'),
      contextValue: {},
    });
    const results: unknown[] = [];

    for await (const event of events as AsyncIterable<unknown>) {
      results.push(event);
    }

    expect(results).toEqual([
      { data: { userEvents: { id: '1' } } },
      { data: { userEvents: { id: '2' } } },
    ]);
    expect(seen).toEqual([user1!.username, user2!.username]);
    expect(drizzleLogs).toHaveLength(2);
  });
});
