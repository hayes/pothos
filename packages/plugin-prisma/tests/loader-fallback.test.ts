import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Fields resolved through the model loader fallback: the loaded row replaces the parent the
// resolver sees, so the loader query has to satisfy the parent type's own selection too.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const User = builder.prismaObject('User', {
  select: {
    name: true,
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    summary: t.string({
      select: {
        posts: {
          select: {
            id: true,
          },
        },
      },
      resolve: (user) => `${user.name}:${user.posts.length}`,
    }),
    // Selects nothing from the parent row at runtime, so it is never answered from the planned
    // query. The cast only gives the resolver its parent shape.
    shout: t.string({
      nullable: true,
      select: () => null as unknown as { name: true },
      resolve: (user) => user.name?.toUpperCase(),
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    // Returns a row fetched without the planned selection, so every field with a `select`
    // has to load its own data through the model loader.
    rawUser: t.field({
      type: User,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('model loader fallback', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("selects the parent type's type-level select alongside the field's select", async () => {
    const planned = await execute({
      schema,
      document: gql`
        query {
          user {
            summary
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(planned.errors).toBeUndefined();
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          select: { id: true, name: true, posts: { select: { id: true } } },
          where: { id: 1 },
        },
      },
    ]);
    queries.length = 0;

    const raw = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            summary
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(raw.errors).toBeUndefined();
    expect(raw.data).toEqual({ rawUser: (planned.data as { user: unknown }).user });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { where: { id: 1 } },
      },
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          select: { id: true, name: true, posts: { select: { id: true } } },
          where: { id: 1 },
        },
      },
    ]);
  });

  it('loads a field whose select returns nothing through the fallback', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: 1 } });
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            shout
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { shout: user.name?.toUpperCase() ?? null } });
    // The planned query and the fallback both carry only the type-level select.
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { select: { id: true, name: true }, where: { id: 1 } },
      },
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { select: { id: true, name: true }, where: { id: 1 } },
      },
    ]);
  });
});
