import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  type CapturedExecution,
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});

function schema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [ErrorsPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract },
  });
  builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      posts: t.relatedConnection('posts', {
        cursor: 'id',
        totalCount: true,
        errors: { types: [] },
      }),
      countFromCallback: t.relatedConnection('posts', { cursor: 'id', totalCount: () => 23 }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        totalCount: true,
        errors: { types: [] },
        resolve: () => ctx.ormClient.User,
      }),
      people: t.prismaField({ type: ['User'], resolve: () => ctx.ormClient.User }),
    }),
  });
  return builder.toSchema();
}

it('counts only once through aliases, named fragments, directives, and an errors wrapper', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      variableValues: { skip: true },
      document: parse(`query($skip: Boolean!) {
      result: users { ... on QueryUsersSuccess { value: data { ...Counts edges @skip(if: $skip) { node { id } } } } }
    }
    fragment Counts on QueryUsersConnection { one: totalCount two: totalCount }`),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ result: { value: { one: 2, two: 2 } } });
  expect(captures).toHaveLength(1);
  expect(captures[0].sql).toMatch(/count\(/i);
  expect(captures[0].sql).not.toMatch(/limit/i);
});

it('omits related page queries for aliased count-only selections inside errors wrappers', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse(`{
      people { id first: posts { ... on UserPostsSuccess { data { n: totalCount } } }
        second: posts { ... on UserPostsSuccess { data { totalCount } } } }
    }`),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    people: [
      { id: 'u-alice', first: { data: { n: 2 } }, second: { data: { totalCount: 2 } } },
      { id: 'u-bob', first: { data: { n: 2 } }, second: { data: { totalCount: 2 } } },
    ],
  });
  expect(captures).toHaveLength(1);
  expect(captures[0].sql).toMatch(/count\(/i);
  expect(captures[0].sql).not.toMatch(/limit/i);
});

it('does not preload a relation when only a callback totalCount is selected', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse('{ people { countFromCallback { totalCount } } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    people: [{ countFromCallback: { totalCount: 23 } }, { countFromCallback: { totalCount: 23 } }],
  });
  expect(captures).toHaveLength(1);
  expect(captures[0].sql).not.toMatch(/post|count\(/i);
});
