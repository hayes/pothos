import SchemaBuilder from '@pothos/core';
import RelayPlugin, { encodeGlobalID } from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { GraphQLError } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  relay: {},
  scopeAuth: { authScopes: () => ({}) },
});

const User = builder.drizzleNode('users', {
  name: 'User',
  select: { columns: { id: true } },
  id: { column: (user) => user.id },
  fields: (t) => ({
    // Not on the type's selection, so a row from a plain resolver is reloaded for it.
    firstName: t.string({
      nullable: true,
      select: { columns: { firstName: true } },
      resolve: (user) => user.firstName,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    missingUser: t.field({
      type: User,
      nullable: true,
      resolve: () => ({ id: 999_999 }),
    }),
  }),
});

const schema = builder.toSchema();

const userId = (id: number) => encodeGlobalID('User', id);

describe('rows that do not exist', () => {
  it('resolves a node that does not exist as null', async () => {
    const result = await execute({
      schema,
      document: gql`
        query ($id: ID!) {
          node(id: $id) {
            id
          }
        }
      `,
      variableValues: { id: userId(999_999) },
      contextValue: {},
    });

    expect(result).toEqual({ data: { node: null } });
  });

  it('resolves only the missing nodes of a list as null', async () => {
    const result = await execute({
      schema,
      document: gql`
        query ($ids: [ID!]!) {
          nodes(ids: $ids) {
            id
            ... on User {
              firstName
            }
          }
        }
      `,
      variableValues: { ids: [userId(1), userId(999_999), userId(2)] },
      contextValue: {},
    });

    expect(result).toEqual({
      data: {
        nodes: [
          { id: userId(1), firstName: expect.any(String) },
          null,
          { id: userId(2), firstName: expect.any(String) },
        ],
      },
    });
  });

  it('fails a parent reload of a row that does not exist without naming it', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          missingUser {
            firstName
          }
        }
      `,
      contextValue: {},
    });

    expect(result.data).toEqual({ missingUser: { firstName: null } });
    expect(result.errors).toHaveLength(1);

    const [error] = result.errors as GraphQLError[];

    expect(error.message).toBe('Unexpected error.');
    expect((error.originalError?.cause as Error).message).toBe('Model users(999999) not found');
  });
});
