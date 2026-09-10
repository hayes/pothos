import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

// A `drizzleNode` whose `id.column` is not the table's primary key. The id a row serializes to
// has to parse back into a row the loader can find: keyed by the column's typescript name (which
// is what the serializer reads and what a row carries), and matched on the columns the loader was
// given rather than on the primary key, which such a row does not carry.
const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  relay: {},
  scopeAuth: { authScopes: () => ({}) },
});

// `users.username` is unique and notNull, and shares its name with its column.
builder.drizzleNode('users', {
  name: 'UserByUsername',
  id: { column: (user) => user.username },
  fields: (t) => ({ firstName: t.exposeString('firstName', { nullable: true }) }),
});

// `profile.userId` is `user_id` in the database: a typescript name that differs from the column.
builder.drizzleNode('userProfile', {
  name: 'ProfileByUser',
  id: { column: (profile) => profile.userId },
  fields: (t) => ({ bio: t.exposeString('bio', { nullable: true }) }),
});

builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

const schema = builder.toSchema({});

const query = gql`
  query ($id: ID!) {
    node(id: $id) {
      __typename
      id
      ... on UserByUsername {
        firstName
      }
      ... on ProfileByUser {
        bio
      }
    }
  }
`;

function globalID(typename: string, id: string) {
  return Buffer.from(`${typename}:${id}`).toString('base64');
}

it('loads a node by a unique column that is not the primary key', async () => {
  const [user] = await db.query.users.findMany({
    limit: 1,
    columns: { username: true, firstName: true },
  });

  const result = await execute({
    schema,
    document: query,
    contextValue: {},
    variableValues: { id: globalID('UserByUsername', user.username) },
  });

  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    node: {
      __typename: 'UserByUsername',
      id: globalID('UserByUsername', user.username),
      firstName: user.firstName,
    },
  });
});

it('loads a node by a column whose name differs from its typescript name', async () => {
  const [profile] = await db.query.userProfile.findMany({
    limit: 1,
    columns: { userId: true, bio: true },
  });

  const result = await execute({
    schema,
    document: query,
    contextValue: {},
    variableValues: { id: globalID('ProfileByUser', String(profile.userId)) },
  });

  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    node: {
      __typename: 'ProfileByUser',
      id: globalID('ProfileByUser', String(profile.userId)),
      bio: profile.bio,
    },
  });
});
