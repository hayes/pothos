import SchemaBuilder, { PothosError } from '@pothos/core';
import RelayPlugin, { encodeGlobalID } from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { afterAll, describe, expect, it } from 'vitest';
import PrismaPlugin, { type PrismaClient, type PrismaTypesFromClient } from '../src';
import type { User } from './client/client.js';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

// Mistakes in the app that only show up while a request runs: clients see `Unexpected error.`,
// and the detail is on the error's `cause`.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { client: PrismaClient };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  relay: {},
  prisma: {
    client: (ctx) => ctx.client,
    dmmf: getDatamodel(),
    onUnusedQuery: 'error',
  },
});

const UserNode = builder.prismaNode('User', {
  variant: 'UserNode',
  id: { field: 'id' },
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author', { type: UserNode }),
  }),
});

const UserInterface = builder.prismaInterface('User', {
  name: 'UserInterface',
  fields: (t) => ({
    posts: t.relatedConnection('posts', {
      cursor: 'id',
      totalCount: true,
      // Gives the field a fallback; only the count it loads beside the page is read here.
      resolve: () => [],
    }),
  }),
});

// A plain object type implementing a prisma interface: its rows have no model loader.
const PlainUser = builder.objectRef<User>('PlainUser').implement({
  interfaces: [UserInterface],
  isTypeOf: () => true,
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

builder.queryType({
  fields: (t) => ({
    plainUser: t.field({
      type: PlainUser,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }),
    }),
    ignoresQuery: t.prismaField({
      type: Post,
      resolve: () => prisma.post.findUniqueOrThrow({ where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('request-time errors', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('hides a missing model delegate on the client', async () => {
    const result = await execute({
      schema,
      document: gql`
        query ($id: ID!) {
          node(id: $id) {
            id
          }
        }
      `,
      variableValues: { id: encodeGlobalID('UserNode', '1') },
      contextValue: { client: { $connect: () => Promise.resolve() } },
    });

    expect(result.errors?.map((error) => error.message)).toEqual(['Unexpected error.']);
    expect((result.errors?.[0]?.originalError?.cause as Error).message).toBe(
      'Unable to find delegate for model User',
    );
  });

  it('hides a totalCount for a parent type without a loader', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          plainUser {
            posts(first: 1) {
              totalCount
            }
          }
        }
      `,
      contextValue: { client: prisma },
    });

    expect(result.errors?.map((error) => error.message)).toEqual(['Unexpected error.']);
    expect((result.errors?.[0]?.originalError?.cause as Error).message).toBe(
      'Unable to load totalCount for PlainUser.posts: no loader for the parent type',
    );
  });

  it('reports an unused query with onUnusedQuery: error', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          ignoresQuery {
            author {
              email
            }
          }
        }
      `,
      contextValue: { client: prisma },
    });

    expect(result.errors?.map((error) => error.message)).toEqual([
      'Prisma query was unused in resolver for Query.ignoresQuery',
    ]);
    expect(result.errors?.[0]?.originalError).toBeInstanceOf(PothosError);
  });
});
