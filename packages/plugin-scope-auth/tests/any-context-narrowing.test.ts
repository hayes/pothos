import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';

// NOTE: the `@ts-expect-error` below is the real assertion for the `$any` narrowing fix, and
// `pnpm test` does NOT check it — vitest's typecheck reports `Type Errors  no errors` even with
// the fix reverted. Run `pnpm --filter @pothos/plugin-scope-auth run type` (tsc against
// tsconfig.type.json) to catch the regression, which surfaces as TS2578 "Unused
// '@ts-expect-error' directive".

interface Context {
  user: { id: string } | null;
  admin: { id: string } | null;
}

interface BuilderTypes {
  Context: Context;
  DefaultAuthStrategy: 'all';
  AuthScopes: {
    user: boolean;
    admin: boolean;
  };
  AuthContexts: {
    user: Context & { user: { id: string } };
    admin: Context & { admin: { id: string } };
  };
}

const builder = new SchemaBuilder<BuilderTypes>({
  plugins: [ScopeAuthPlugin],
  // required by the prisma plugin's global type augmentation, unused by these tests
  prisma: { client: db, dmmf: getDatamodel() },
  scopeAuth: {
    defaultStrategy: 'all',
    authScopes: (context) => ({
      user: !!context.user,
      admin: !!context.admin,
    }),
  },
});

builder.queryType({
  fields: (t) => ({
    // `$any` only guarantees that ONE of the scopes passed, so the narrowed context must stay a
    // union of the two auth contexts, even though the default strategy is `all`.
    explicitAny: t.withAuth({ $any: { user: true, admin: true } }).string({
      resolve: (_parent, _args, context) => context.user?.id ?? context.admin?.id ?? 'none',
    }),
    explicitAnyUnsafe: t.withAuth({ $any: { user: true, admin: true } }).string({
      resolve: (_parent, _args, context) =>
        // @ts-expect-error `$any` does not guarantee the `admin` context
        context.admin.id,
    }),
    // The default `all` strategy still intersects the contexts of every key in the map.
    implicitAll: t.withAuth({ user: true, admin: true }).string({
      resolve: (_parent, _args, context) => `${context.user.id}:${context.admin.id}`,
    }),
    explicitAll: t.withAuth({ $all: { user: true, admin: true } }).string({
      resolve: (_parent, _args, context) => `${context.user.id}:${context.admin.id}`,
    }),
    // A map mixing a plain scope with `$any` intersects the plain scope with the `$any` union.
    mixed: t.withAuth({ user: true, $any: { admin: true } }).string({
      resolve: (_parent, _args, context) => `${context.user.id}:${context.admin.id}`,
    }),
  }),
});

const schema = builder.toSchema();

describe('$any context narrowing with a default strategy of all', () => {
  it('resolves with only one of the $any contexts available', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          explicitAny
        }
      `,
      contextValue: { user: { id: '1' }, admin: null },
    });

    // Only `user` is authorized, so `admin` is absent at runtime — the narrowed type must not
    // claim otherwise.
    expect(result.data).toEqual({ explicitAny: '1' });
    expect(result.errors).toBeUndefined();
  });

  it('still requires every scope for the default all strategy', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          implicitAll
          explicitAll
          mixed
        }
      `,
      contextValue: { user: { id: '1' }, admin: null },
    });

    expect(result.data).toEqual({ implicitAll: null, explicitAll: null, mixed: null });
  });
});
