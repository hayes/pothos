import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import RequestCache from '../src/request-cache';
import { db } from './example/db';

interface BuilderTypes {
  Context: {};
  DefaultAuthStrategy: 'all';
  AuthScopes: {
    yes: boolean;
    no: boolean;
  };
}

function createBuilder() {
  return new SchemaBuilder<BuilderTypes>({
    plugins: [ScopeAuthPlugin],
    // required by the prisma plugin's global type augmentation, unused by these tests
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      defaultStrategy: 'all',
      authScopes: () => ({
        yes: true,
        no: false,
      }),
    },
  });
}

describe('scope map cache', () => {
  it('does not share cached results between $any and $all', async () => {
    const builder = createBuilder();
    // The same scope map object is used in both an `$any` and an `$all` requirement.
    const shared = { yes: true, no: true };

    builder.queryType({
      fields: (t) => ({
        any: t.string({
          authScopes: { $any: shared },
          resolve: () => 'allowed',
        }),
        all: t.string({
          authScopes: { $all: shared },
          resolve: () => 'SECRET',
        }),
      }),
    });

    const schema = builder.toSchema();

    const anyFirst = await execute({
      schema,
      document: gql`
        query {
          any
          all
        }
      `,
      contextValue: {},
    });

    const allFirst = await execute({
      schema,
      document: gql`
        query {
          all
          any
        }
      `,
      contextValue: {},
    });

    // Authorization must not depend on the order the fields appear in the query.
    expect(anyFirst.data).toEqual({ any: 'allowed', all: null });
    expect(allFirst.data).toEqual({ any: 'allowed', all: null });
  });

  it('still caches results for a map evaluated repeatedly under the same strategy', async () => {
    const builder = createBuilder();
    const shared = { yes: true };

    builder.queryType({
      fields: (t) => ({
        // `all` strategy (the default), evaluated twice
        a: t.string({ authScopes: shared, resolve: () => 'a' }),
        b: t.string({ authScopes: shared, resolve: () => 'b' }),
        // `any` strategy, evaluated twice
        c: t.string({ authScopes: { $any: shared }, resolve: () => 'c' }),
        d: t.string({ authScopes: { $any: shared }, resolve: () => 'd' }),
      }),
    });

    const schema = builder.toSchema();
    const evaluate = vi.spyOn(RequestCache.prototype, 'evaluateScopeMapWithScopes');

    try {
      const result = await execute({
        schema,
        document: gql`
          query {
            a
            b
            c
            d
          }
        `,
        contextValue: {},
      });

      expect(result.data).toEqual({ a: 'a', b: 'b', c: 'c', d: 'd' });

      // `shared` is evaluated once per strategy, not once per field.
      const sharedEvaluations = evaluate.mock.calls.filter((call) => call[0] === shared);

      expect(sharedEvaluations).toHaveLength(2);
      expect(sharedEvaluations.map((call) => call[3])).toEqual([true, false]);
    } finally {
      evaluate.mockRestore();
    }
  });
});
