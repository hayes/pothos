import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse, printSchema } from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});
it('materializes a list inside a root errors success wrapper as a list', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [ErrorsPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract },
  });
  builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        errors: { types: [] },
        resolve: () => ctx.ormClient.User,
      }),
    }),
  });
  const schema = builder.toSchema();
  const result = await execute({
    schema,
    contextValue: {},
    document: parse('{users{... on QueryUsersSuccess { data {id} }}}'),
  });
  expect(result.errors, printSchema(schema)).toBeUndefined();
  expect(result.data).toEqual({ users: { data: [{ id: 'u-alice' }, { id: 'u-bob' }] } });
});
