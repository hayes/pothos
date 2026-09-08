import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { user: { id: number } };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    title: t.exposeString('title'),
  }),
});

builder.drizzleObject('userProfile', {
  name: 'Profile',
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio', { nullable: true }),
  }),
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    profile: t.relation('profile', { nullable: true }),
    posts: t.relation('posts'),
    postCount: t.relatedCount('posts'),
    postsConnection: t.relatedConnection('posts', {
      totalCount: true,
      query: () => ({ orderBy: { postId: 'desc' } }),
    }),
    postsWithResolve: t.relatedConnection('posts', {
      // A custom resolver was accepted and silently discarded; it is now rejected.
      // @ts-expect-error resolve is not an option for relatedConnection
      resolve: () => [],
    }),
  }),
});

// The third argument is optional, so a helper with no custom selection is a two-argument call.
const commentHelpers = drizzleConnectionHelpers(builder, 'comments');

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('relation loading', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('builds connection helpers without options', () => {
    expect(typeof commentHelpers.getQuery).toBe('function');
  });
});
