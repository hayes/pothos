import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

function createSchema(mode: 'sync' | 'asyncId' | 'asyncWhere', error?: Error) {
  const resolvePosts = vi.fn((query: object, user: { id: number }) =>
    prisma.post.findMany({ ...query, where: { authorId: user.id } } as never),
  );
  const builder = new SchemaBuilder<{
    PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  }>({
    plugins: [PrismaPlugin, RelayPlugin],
    relay: {},
    prisma: { client: prisma, dmmf: getDatamodel() },
  });

  builder.prismaObject('Post', {
    fields: (t) => ({ id: t.exposeID('id') }),
  });

  const User = builder.prismaNode('User', {
    id: {
      resolve: (user) =>
        mode === 'asyncId'
          ? error
            ? Promise.reject(error)
            : Promise.resolve(String(user.id))
          : String(user.id),
    },
    findUnique: (id) =>
      mode === 'asyncWhere'
        ? error
          ? Promise.reject(error)
          : Promise.resolve({ id: Number(id) })
        : { id: Number(id) },
    fields: (t) => ({
      posts: t.relatedConnection('posts', {
        cursor: 'id',
        totalCount: true,
        resolve: resolvePosts,
      }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      user: t.field({
        type: User,
        resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }),
      }),
    }),
  });

  return { schema: builder.toSchema(), resolvePosts };
}

it.each([
  'sync',
  'asyncId',
  'asyncWhere',
] as const)('loads fallback totalCount with %s lookup', async (mode) => {
  const { schema, resolvePosts } = createSchema(mode);
  const count = await prisma.post.count({ where: { authorId: 1 } });

  const countOnly = await execute({
    schema,
    document: gql`{ user { posts { totalCount } } }`,
    contextValue: {},
  });

  expect(countOnly.errors).toBeUndefined();
  expect(countOnly.data).toEqual({ user: { posts: { totalCount: count } } });
  expect(resolvePosts).not.toHaveBeenCalled();

  const withRows = await execute({
    schema,
    document: gql`{ user { posts(first: 1) { totalCount edges { node { id } } } } }`,
    contextValue: {},
  });

  expect(withRows.errors).toBeUndefined();
  expect(withRows.data).toEqual({
    user: {
      posts: { totalCount: count, edges: [{ node: { id: expect.any(String) } }] },
    },
  });
  expect(resolvePosts).toHaveBeenCalledOnce();
});

it.each(['asyncId', 'asyncWhere'] as const)('propagates a rejected %s lookup', async (mode) => {
  const { schema, resolvePosts } = createSchema(mode, new Error('lookup failed'));
  const result = await execute({
    schema,
    document: gql`{ user { posts { totalCount } } }`,
    contextValue: {},
  });

  expect(result.errors).toHaveLength(1);
  expect(result.errors?.[0].message).toBe('lookup failed');
  expect(resolvePosts).not.toHaveBeenCalled();
});
