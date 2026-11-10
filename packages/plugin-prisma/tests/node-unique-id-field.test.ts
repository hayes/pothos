import SchemaBuilder from '@pothos/core';
import RelayPlugin, { encodeGlobalID } from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// A select-mode `prismaNode` whose `id.field` is a unique key other than the primary key: the
// global ID and the reload's `where` both read that key, so it must be selected.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  relay: {},
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const Comment = builder.prismaObject('Comment', {
  select: { id: true },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Post = builder.prismaNode('Post', {
  id: { field: 'bigIntId' },
  select: {},
  fields: (t) => ({
    comments: t.relation('comments', {
      args: { take: t.arg.int({ required: true }) },
      query: (args) => ({ take: args.take, orderBy: { id: 'asc' } }),
      type: Comment,
    }),
  }),
});

const FindUniqueRelation = builder.prismaObject('FindUniqueRelations', {
  select: { id: true },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

// The type's default ID is `a_b`, so `a_c` brings in `c`.
const CompositeUnique = builder.prismaNode('WithCompositeUnique', {
  id: { field: 'a_c' },
  select: {},
  fields: (t) => ({
    relations: t.relation('FindUniqueRelations', {
      args: { take: t.arg.int({ required: true }) },
      query: (args) => ({ take: args.take, orderBy: { id: 'asc' } }),
      type: FindUniqueRelation,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    post: t.prismaField({
      type: Post,
      resolve: (query) => prisma.post.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    compositeUnique: t.prismaField({
      type: CompositeUnique,
      resolve: (query) =>
        prisma.withCompositeUnique.findUniqueOrThrow({
          ...query,
          where: { a_b: { a: '1', b: '1' } },
        }),
    }),
  }),
});

const schema = builder.toSchema();

describe('select-mode prismaNode with a non-primary unique id field', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('serializes the global ID from a unique field', async () => {
    const { bigIntId } = await prisma.post.findUniqueOrThrow({ where: { id: 1 } });
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql`
        query {
          post {
            id
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { post: { id: encodeGlobalID('Post', String(bigIntId)) } } });
  });

  it('reloads by a unique field for aliases with different arguments', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          post {
            one: comments(take: 1) {
              id
            }
            two: comments(take: 2) {
              id
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(queries).toContainEqual(
      expect.objectContaining({
        action: 'findUniqueOrThrow',
        model: 'Post',
        args: expect.objectContaining({ where: { bigIntId: expect.anything() } }),
      }),
    );
    expect(result.data).toEqual({
      post: {
        one: [{ id: expect.any(String) }],
        two: [{ id: expect.any(String) }, { id: expect.any(String) }],
      },
    });
  });

  it('serializes the global ID from a compound unique index', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          compositeUnique {
            id
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({
      data: { compositeUnique: { id: encodeGlobalID('WithCompositeUnique', '["1","1"]') } },
    });
  });

  it('reloads by a compound unique index for aliases with different arguments', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          compositeUnique {
            one: relations(take: 1) {
              id
            }
            two: relations(take: 2) {
              id
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({
      data: { compositeUnique: { one: [{ id: '1' }], two: [{ id: '1' }] } },
    });
    expect(queries).toContainEqual(
      expect.objectContaining({
        action: 'findUniqueOrThrow',
        model: 'WithCompositeUnique',
        args: expect.objectContaining({ where: { a_c: { a: '1', c: '1' } } }),
      }),
    );
  });
});
