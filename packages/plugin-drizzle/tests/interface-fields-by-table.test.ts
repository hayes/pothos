import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { type GraphQLInterfaceType, isInterfaceType } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, relations } from './example/db';

// `drizzleInterfaceField(s)` take the table name as well as the interface ref, as the docs say:
// the name resolves to the interface `drizzleInterface` registered under it, not to an object.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
}>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

const Viewer = builder.drizzleInterface('users', {
  select: { columns: { id: true } },
  resolveType: () => 'NormalViewer',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.drizzleObject('users', {
  variant: 'NormalViewer',
  interfaces: [Viewer],
});

builder.drizzleInterfaceField('users', 'username', (t) =>
  t.string({
    select: { columns: { username: true } },
    resolve: (user) => `@${user.username}`,
  }),
);

builder.drizzleInterfaceFields('users', (t) => ({
  firstName: t.exposeString('firstName', { nullable: true }),
  postCount: t.relatedCount('posts'),
}));

builder.queryType({
  fields: (t) => ({
    viewer: t.drizzleField({
      type: Viewer,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('interface fields added by table name', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('adds the fields to the interface', () => {
    const viewer = schema.getType('users');

    expect(isInterfaceType(viewer)).toBe(true);
    expect(Object.keys((viewer as GraphQLInterfaceType).getFields()).sort()).toEqual([
      'firstName',
      'id',
      'postCount',
      'username',
    ]);
  });

  it('resolves them on an implementation, planned into the interface query', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          viewer {
            id
            username
            firstName
            postCount
            ... on NormalViewer {
              id
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      viewer: {
        id: '1',
        username: expect.stringMatching(/^@/),
        firstName: expect.any(String),
        postCount: expect.any(Number),
      },
    });
  });
});
