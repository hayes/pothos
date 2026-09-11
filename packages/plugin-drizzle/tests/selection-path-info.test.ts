import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { execute, parse } from 'graphql';
import { expect, it } from 'vitest';
import DrizzlePlugin, { type DrizzleFieldSelection } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

it('gives an exported DrizzleFieldSelection callback its declared PathInfo', async () => {
  const captured: unknown[] = [];
  const select: DrizzleFieldSelection = (_args, _ctx, _nested, _selected, pathInfo) => {
    captured.push({ path: pathInfo.path, segments: pathInfo.segments });
    return { columns: { id: true } };
  };
  const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations; AsyncSelections: true }>({
    plugins: [ScopeAuthPlugin, DrizzlePlugin],
    scopeAuth: { authScopes: () => ({}) },
    drizzle: { client: db, relations, getTableConfig },
  });
  const User = builder.drizzleObject('users', {
    name: 'User',
    select: { columns: {} },
    fields: (t) => ({
      value: t.string({ extensions: { pothosDrizzleSelect: select }, resolve: () => 'ok' }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.drizzleField({
        type: [User],
        resolve: (query) => {
          query();
          return [{ id: 1 }] as never;
        },
      }),
    }),
  });
  const result = await execute({
    schema: builder.toSchema(),
    document: parse('{ users { alias: value } }'),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(captured).toEqual([
    {
      path: ['Query.users', 'User.value'],
      segments: [
        { field: 'users', alias: 'users', parentType: 'Query', isList: true },
        { field: 'value', alias: 'alias', parentType: 'User', isList: false },
      ],
    },
  ]);
});

it.each([
  false,
  true,
])('gives a nestedSelection query callback PathInfo (async=%s)', async (asyncQuery) => {
  const captured: unknown[] = [];
  const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations; AsyncSelections: true }>({
    plugins: [ScopeAuthPlugin, DrizzlePlugin],
    scopeAuth: { authScopes: () => ({}) },
    drizzle: { client: db, relations, getTableConfig },
  });
  const Post = builder.drizzleObject('posts', {
    name: 'Post',
    fields: (t) => ({ id: t.exposeID('postId') }),
  });
  const User = builder.drizzleObject('users', {
    name: 'User',
    select: { columns: {} },
    fields: (t) => ({
      posts: t.field({
        type: [Post],
        select: async (_args, _ctx, nested) => ({
          with: {
            posts: await nested((_args, _ctx, pathInfo) => {
              captured.push({ path: pathInfo.path, segments: pathInfo.segments });
              return asyncQuery ? Promise.resolve({ limit: 1 }) : { limit: 1 };
            }),
          },
        }),
        resolve: (user) => user.posts,
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.drizzleField({
        type: [User],
        resolve: (query) => {
          query();
          return [] as never;
        },
      }),
    }),
  });
  const result = await execute({
    schema: builder.toSchema(),
    document: parse('{ users { alias: posts { id } } }'),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(captured).toEqual([
    {
      path: ['Query.users', 'User.posts'],
      segments: [
        { field: 'users', alias: 'users', parentType: 'Query', isList: true },
        { field: 'posts', alias: 'alias', parentType: 'User', isList: true },
      ],
    },
  ]);
});
