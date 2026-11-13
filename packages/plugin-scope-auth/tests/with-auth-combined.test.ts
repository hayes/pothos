import SchemaBuilder from '@pothos/core';
import { graphql, parse, subscribe } from 'graphql';
import { vi } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';

interface Context {
  loggedIn: boolean;
  admin: boolean;
  permissions: string[];
}

function createSchema() {
  const permission = vi.fn((_perm: string) => false);
  const adminScopes = vi.fn(() => ({ admin: true }));

  const builder = new SchemaBuilder<{
    Context: Context;
    AuthScopes: { loggedIn: boolean; admin: boolean; permission: string };
  }>({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      authorizeOnSubscribe: true,
      authScopes: (context) => ({
        loggedIn: context.loggedIn,
        admin: context.admin,
        permission: (perm: string) => {
          permission(perm);

          return context.permissions.includes(perm);
        },
      }),
    },
  });

  builder.queryType({
    fields: (t) => ({
      combined: t.withAuth({ loggedIn: true }).string({
        authScopes: { admin: true },
        resolve: () => 'combined',
      }),
      chained: t
        .withAuth({ loggedIn: true })
        .withAuth({ admin: true })
        .string({
          resolve: () => 'chained',
        }),
      functionScopes: t.withAuth({ loggedIn: true }).string({
        authScopes: adminScopes,
        resolve: () => 'function',
      }),
      duplicateKeys: t.withAuth({ permission: 'a' }).string({
        authScopes: { permission: 'b' },
        resolve: () => 'duplicate',
      }),
    }),
  });

  builder.subscriptionType({
    fields: (t) => ({
      combinedSubscription: t.withAuth({ loggedIn: true }).string({
        authScopes: { admin: true },
        // biome-ignore lint/suspicious/useAwait: testing
        subscribe: async function* subscribe() {
          yield 'combined';
        },
        resolve: (value) => value,
      }),
    }),
  });

  return { schema: builder.toSchema(), adminScopes, permission };
}

async function run(context: Context, source = '{ combined chained functionScopes duplicateKeys }') {
  const { schema, adminScopes, permission } = createSchema();
  const result = await graphql({ schema, source, contextValue: context });

  return { result, adminScopes, permission };
}

describe('withAuth combined with authScopes', () => {
  it('runs both checks when both pass', async () => {
    const { result, adminScopes, permission } = await run({
      loggedIn: true,
      admin: true,
      permissions: ['a', 'b'],
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      combined: 'combined',
      chained: 'chained',
      functionScopes: 'function',
      duplicateKeys: 'duplicate',
    });
    expect(adminScopes).toHaveBeenCalledTimes(1);
    expect(permission.mock.calls).toEqual([['a'], ['b']]);
  });

  it('runs both checks when the authScopes check fails', async () => {
    const { result, adminScopes } = await run({
      loggedIn: true,
      admin: false,
      permissions: ['a', 'b'],
    });

    expect(result.data).toEqual({
      combined: null,
      chained: null,
      functionScopes: null,
      duplicateKeys: 'duplicate',
    });
    expect(adminScopes).toHaveBeenCalledTimes(1);
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to resolve Query.combined',
      'Not authorized to resolve Query.chained',
      'Not authorized to resolve Query.functionScopes',
    ]);
  });

  it('skips the authScopes function when the withAuth check fails', async () => {
    const { result, adminScopes } = await run({
      loggedIn: false,
      admin: true,
      permissions: ['a', 'b'],
    });

    expect(result.data).toEqual({
      combined: null,
      chained: null,
      functionScopes: null,
      duplicateKeys: 'duplicate',
    });
    expect(adminScopes).not.toHaveBeenCalled();
  });

  it('evaluates colliding keys sequentially instead of overwriting them', async () => {
    const { result, permission } = await run({
      loggedIn: true,
      admin: true,
      permissions: ['b'],
    });

    expect(result.data?.duplicateKeys).toBe(null);
    expect(permission.mock.calls).toEqual([['a']]);
  });
});

describe('withAuth combined with authScopes on subscriptions', () => {
  it('runs both checks before subscribing', async () => {
    const { schema } = createSchema();
    const document = parse('subscription { combinedSubscription }');

    const authorized = await subscribe({
      schema,
      document,
      contextValue: { loggedIn: true, admin: true, permissions: [] },
    });

    const iterator = authorized as AsyncIterable<{
      data: { combinedSubscription: string };
    }>;
    const first = await iterator[Symbol.asyncIterator]().next();
    expect(first.value.data).toEqual({ combinedSubscription: 'combined' });

    const denied = await subscribe({
      schema,
      document,
      contextValue: { loggedIn: true, admin: false, permissions: [] },
    });

    expect(denied).toMatchObject({
      errors: [{ message: 'Not authorized to resolve Subscription.combinedSubscription' }],
    });
  });
});
