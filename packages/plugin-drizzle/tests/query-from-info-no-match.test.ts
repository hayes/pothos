import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { GraphQLResolveInfo } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { getSchemaConfig } from '../src/utils/config';
import { queryFromInfo } from '../src/utils/map-query';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// `queryFromInfo` with `path`/`paths` that select nothing: the caller gets back its own selection,
// or an empty query it can pass straight to drizzle.
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

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts'),
  }),
});

const SelectUser = builder.drizzleObject('users', {
  variant: 'SelectUser',
  select: {
    columns: {
      username: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

interface EntryShape {
  kind: string;
  user: { id: number; username: string; firstName: string | null; lastName: string | null };
}

const Entry = builder.objectRef<EntryShape>('Entry').implement({
  fields: (t) => ({
    kind: t.exposeString('kind'),
    user: t.field({ type: User, resolve: (entry) => entry.user }),
    selectUser: t.field({ type: SelectUser, resolve: (entry) => entry.user }),
  }),
});

const plannedQueries: unknown[] = [];

async function resolveEntry(query: object): Promise<EntryShape> {
  plannedQueries.push(query);

  const user = await db.query.users.findFirst({ ...query, where: { id: 1 } });

  if (!user) {
    throw new Error('User 1 not found');
  }

  return { kind: 'entry', user };
}

function planFor(context: object, info: GraphQLResolveInfo, typeName: string, path: string[]) {
  return queryFromInfo({ config: getSchemaConfig(builder), context, info, typeName, path });
}

builder.queryType({
  fields: (t) => ({
    selectMode: t.field({
      type: Entry,
      resolve: (_root, _args, context, info) =>
        resolveEntry(planFor(context, info, 'SelectUser', ['selectUser'])),
    }),
    selectModeWithInitial: t.field({
      type: Entry,
      resolve: (_root, _args, context, info) =>
        resolveEntry(
          queryFromInfo({
            config: getSchemaConfig(builder),
            context,
            info,
            typeName: 'SelectUser',
            path: ['selectUser'],
            select: { columns: { firstName: true } },
          }),
        ),
    }),
    allColumns: t.field({
      type: Entry,
      resolve: (_root, _args, context, info) =>
        resolveEntry(planFor(context, info, 'User', ['user'])),
    }),
    allColumnsWithInitial: t.field({
      type: Entry,
      resolve: (_root, _args, context, info) =>
        resolveEntry(
          queryFromInfo({
            config: getSchemaConfig(builder),
            context,
            info,
            typeName: 'User',
            path: ['user'],
            select: { with: { posts: true } },
          }),
        ),
    }),
  }),
});

const schema = builder.toSchema();

describe('queryFromInfo with paths that select nothing', () => {
  afterEach(() => {
    clearDrizzleLogs();
    plannedQueries.length = 0;
  });

  it.each([
    ['selectMode', {}],
    ['selectModeWithInitial', { columns: { firstName: true } }],
    ['allColumns', {}],
    ['allColumnsWithInitial', { with: { posts: true } }],
  ])('%s returns the initial selection or an empty query', async (field, expected) => {
    const result = await execute({
      schema,
      document: gql`
        query {
          entry: ${field} {
            kind
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ entry: { kind: 'entry' } });
    expect(plannedQueries).toEqual([expected]);
    expect(drizzleLogs).toHaveLength(1);
  });
});
