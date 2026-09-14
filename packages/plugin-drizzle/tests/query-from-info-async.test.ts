import SchemaBuilder, { isThenable } from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin, { getSchemaConfig, queryFromInfo } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  AsyncSelections: true;
}>({
  plugins: [DrizzlePlugin, ScopeAuthPlugin],
  scopeAuth: { authScopes: () => ({}) },
  drizzle: { client: () => db, relations, getTableConfig },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  select: { columns: {} },
  fields: (t) => ({
    id: t.exposeID('id'),
    asyncName: t.string({
      select: async () => ({ columns: { username: true } }),
      resolve: (user) => user.username,
    }),
  }),
});

const planned: unknown[] = [];
const wasAsync: boolean[] = [];
builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: User,
      args: { awaitSelections: t.arg.boolean(), builderHelper: t.arg.boolean() },
      resolve: async (_root, args, context, info) => {
        const query = args.builderHelper
          ? t.drizzleQueryFromInfo(User, { context, info, columns: { id: true } })
          : queryFromInfo({
              config: getSchemaConfig(builder),
              context,
              info,
              columns: { id: true },
              awaitSelections: args.awaitSelections ?? false,
            });
        wasAsync.push(isThenable(query));
        planned.push(await query);
        return { id: 1, username: 'test', firstName: null, lastName: null };
      },
    }),
  }),
});
const schema = builder.toSchema();

beforeEach(() => {
  planned.length = 0;
  wasAsync.length = 0;
});

it('rejects async selections without opt-in', async () => {
  const result = await execute({ schema, contextValue: {}, document: gql`{ user { asyncName } }` });
  expect(result.errors?.[0].message).toBe(
    'queryFromInfo could not build the query for Query.user synchronously, because a selection beneath it is async. Pass awaitSelections: true and await the result.',
  );
  expect(planned).toEqual([]);
});

it('awaits async selections and merges explicit columns', async () => {
  const result = await execute({
    schema,
    contextValue: {},
    document: gql`{ user(awaitSelections: true) { asyncName } }`,
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ user: { asyncName: 'test' } });
  expect(wasAsync).toEqual([true]);
  expect(planned).toMatchObject([{ columns: { id: true, username: true } }]);
});

it.each([
  false,
  true,
])('keeps synchronous selections synchronous with opt-in %s', async (awaitSelections) => {
  const result = await execute({
    schema,
    contextValue: {},
    document: gql`query($awaitSelections: Boolean) { user(awaitSelections: $awaitSelections) { id } }`,
    variableValues: { awaitSelections },
  });
  expect(result.errors).toBeUndefined();
  expect(wasAsync).toEqual([false]);
  expect(planned).toMatchObject([{ columns: { id: true } }]);
});

it('infers async planning through the field builder helper', async () => {
  const result = await execute({
    schema,
    contextValue: {},
    document: gql`{ user(builderHelper: true) { asyncName } }`,
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ user: { asyncName: 'test' } });
  expect(wasAsync).toEqual([true]);
  expect(planned).toMatchObject([{ columns: { id: true, username: true } }]);
});
