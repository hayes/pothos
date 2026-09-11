import SchemaBuilder from '@pothos/core';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin, {
  applySelectionToCollection,
  type RelationRefinementCollection,
} from '../src';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

type Posts = RelationRefinementCollection<
  PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: SampleContract }>,
  'User',
  'posts'
>;

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});

it('loads inherited interface selections through concrete and interface roots', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract },
  });
  const base = builder.prismaInterface('User', {
    name: 'UserTotals',
    select: { posts: (sub: Posts) => ({ total: sub.count() }) },
    fields: (t) => ({
      total: t.int({ resolve: (parent) => (parent as unknown as { total: number }).total }),
    }),
  });
  const published = builder.prismaInterface('User', {
    name: 'UserPublishedTotals',
    interfaces: [base] as never,
    select: { posts: (sub: Posts) => ({ published: sub.where({ published: 1 }).count() }) },
    fields: (t) => ({
      published: t.int({
        resolve: (parent) => (parent as unknown as { published: number }).published,
      }),
    }),
  });
  const user = builder.prismaObject('User', {
    interfaces: [base, published] as never,
    isTypeOf: () => true,
    select: { posts: true },
    fields: (t) => ({
      id: t.exposeID('id'),
      ownTotal: t.int({ resolve: (parent) => parent.posts.length }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: [user], resolve: () => ctx.ormClient.User }),
      viaInterface: t.field({
        type: [published],
        resolve: async (_parent, _args, context, info) => {
          const collection = await applySelectionToCollection(
            ctx.ormClient.User as never,
            info,
            ctx.contract,
            context,
          );
          return (await (collection as unknown as typeof ctx.ormClient.User).all()) as never;
        },
      }),
    }),
  });
  const result = await execute({
    schema: builder.toSchema(),
    contextValue: {},
    document: parse(`{
      users { id total published ownTotal }
      viaInterface { total published ... on User { id ownTotal } }
    }`),
  });
  expect(result.errors).toBeUndefined();
  const users = [
    { id: 'u-alice', total: 2, published: 1, ownTotal: 2 },
    { id: 'u-bob', total: 2, published: 1, ownTotal: 2 },
  ];
  expect(result.data).toEqual({ users, viaInterface: users });
});
