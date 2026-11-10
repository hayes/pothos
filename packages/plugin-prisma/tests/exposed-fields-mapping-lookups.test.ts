import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

// An exposed field the row holds is read from the row, so resolving it looks up no mapping.
const getLoaderMapping = vi.hoisted(() => vi.fn());

vi.mock('@pothos/selection-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pothos/selection-mapper')>();

  getLoaderMapping.mockImplementation(actual.getLoaderMapping);

  return { ...actual, getLoaderMapping };
});

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypesFromClient<typeof prisma> }>({
  plugins: [PrismaPlugin],
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

const Post = builder.prismaObject('Post', {
  select: { id: true },
  fields: (t) => ({
    id: t.exposeInt('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content', { nullable: true }),
    published: t.exposeBoolean('published'),
  }),
});

builder.queryType({
  fields: (t) => ({
    posts: t.prismaField({
      type: [Post],
      resolve: (query) => prisma.post.findMany({ ...query, take: 10, orderBy: { id: 'asc' } }),
    }),
  }),
});

const schema = builder.toSchema();

afterAll(async () => {
  await prisma.$disconnect();
});

it('looks up no mapping for exposed fields of planned rows', async () => {
  getLoaderMapping.mockClear();

  const result = await execute({
    schema,
    document: gql`
      {
        posts {
          id
          title
          content
          published
        }
      }
    `,
    contextValue: {},
  });

  expect(result.errors).toBeUndefined();
  expect(result.data?.posts).toHaveLength(10);
  expect(getLoaderMapping).not.toHaveBeenCalled();
});
