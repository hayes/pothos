import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [DrizzlePlugin, ScopeAuthPlugin],
  scopeAuth: { authScopes: () => ({}) },
  drizzle: { client: () => db, relations, getTableConfig },
});

const User = builder.drizzleObject('users', {
  name: 'PublicUser',
  select: {},
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('username') }),
});
const PrivateUser = builder.drizzleObject('users', {
  variant: 'PrivateUser',
  select: {},
  fields: (t) => ({ name: t.exposeString('firstName', { nullable: true }) }),
});

const row = { id: 1, username: 'public', firstName: 'private', lastName: null };
const Payload = builder.objectRef<{ user: typeof row }>('UserPayload').implement({
  fields: (t) => ({ user: t.field({ type: User, resolve: (payload) => payload.user }) }),
});
const queries: unknown[] = [];

builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: User,
      args: { useRef: t.arg.boolean() },
      resolve: (_root, args, context, info) => {
        queries.push(builder.drizzleQueryFromInfo(args.useRef ? User : 'users', { context, info }));
        return row;
      },
    }),
    payload: t.field({
      type: Payload,
      resolve: (_root, _args, context, info) => {
        queries.push(
          builder.drizzleQueryFromInfo('users', {
            context,
            info,
            path: ['user'],
            select: { columns: { lastName: true } },
          }),
        );
        return { user: row };
      },
    }),
    privateUser: t.field({
      type: PrivateUser,
      resolve: (_root, _args, context, info) => {
        queries.push(builder.drizzleQueryFromInfo(PrivateUser, { context, info }));
        return row;
      },
    }),
  }),
});
const schema = builder.toSchema();

beforeEach(() => {
  queries.length = 0;
});

it.each([
  false,
  true,
])('plans the registered GraphQL type using a table or ref (%s)', async (useRef) => {
  const result = await execute({
    schema,
    contextValue: {},
    document: gql`query($useRef: Boolean) { user(useRef: $useRef) { name } }`,
    variableValues: { useRef },
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ user: { name: 'public' } });
  expect(queries).toMatchObject([{ columns: { id: true, username: true } }]);
});

it('plans an aliased nested payload field and merges explicit selection', async () => {
  const result = await execute({
    schema,
    contextValue: {},
    document: gql`{ payload { alias: user { name } } }`,
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ payload: { alias: { name: 'public' } } });
  expect(queries).toMatchObject([{ columns: { id: true, lastName: true, username: true } }]);
});

it('uses the supplied variant ref to resolve field selections', async () => {
  const result = await execute({
    schema,
    contextValue: {},
    document: gql`{ privateUser { name } }`,
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ privateUser: { name: 'private' } });
  expect(queries).toMatchObject([{ columns: { id: true, firstName: true } }]);
});
