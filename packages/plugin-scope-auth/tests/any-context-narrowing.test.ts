import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';

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
    explicitAny: t.withAuth({ $any: { user: true, admin: true } }).string({
      resolve: (_parent, _args, context) => context.user?.id ?? context.admin?.id ?? 'none',
    }),
    explicitAnyUnsafe: t.withAuth({ $any: { user: true, admin: true } }).string({
      resolve: (_parent, _args, context) =>
        // @ts-expect-error `$any` does not guarantee the `admin` context
        context.admin.id,
    }),
    implicitAll: t.withAuth({ user: true, admin: true }).string({
      resolve: (_parent, _args, context) => `${context.user.id}:${context.admin.id}`,
    }),
    explicitAll: t.withAuth({ $all: { user: true, admin: true } }).string({
      resolve: (_parent, _args, context) => `${context.user.id}:${context.admin.id}`,
    }),
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
