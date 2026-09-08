import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import type { User as UserRow } from './client/client.js';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Types carrying `pothosIndirectInclude` with `paths`: the selection under the matched paths is
// planned for the target model, and the wrapper's own selection only when the wrapper itself is
// backed by that model.
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
    email: true,
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.relation('posts'),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const nodePaths = { getType: () => 'User', paths: [[{ name: 'node' }]] };

// A variant of the target model that also points at a nested `node` field.
const UserSummary = builder.prismaObject('User', {
  variant: 'UserSummary',
  select: {
    email: true,
    name: true,
  },
  extensions: { pothosIndirectInclude: nodePaths },
  fields: (t) => ({
    node: t.field({ type: User, resolve: (user) => user }),
    reverseName: t.string({
      nullable: true,
      resolve: (user) => user.name?.split('').reverse().join(''),
    }),
  }),
});

// A wrapper without a model of its own.
const UserWrapper = builder.objectRef<{ user: UserRow }>('UserWrapper').implement({
  extensions: { pothosIndirectInclude: nodePaths },
  fields: (t) => ({
    node: t.field({ type: User, resolve: (wrapper) => wrapper.user }),
    label: t.string({ resolve: () => 'wrapper' }),
  }),
});

// A wrapper backed by a different model than the one its `node` points at.
const ProfileWithUser = builder.prismaObject('Profile', {
  variant: 'ProfileWithUser',
  extensions: { pothosIndirectInclude: nodePaths },
  fields: (t) => ({
    bio: t.exposeString('bio', { nullable: true }),
    node: t.prismaField({
      type: User,
      resolve: (query, profile) =>
        prisma.user.findUniqueOrThrow({ ...query, where: { id: profile.userId } }),
    }),
  }),
});

const plannedQueries: unknown[] = [];

builder.queryType({
  fields: (t) => ({
    userSummary: t.prismaField({
      type: UserSummary,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    wrapper: t.field({
      type: UserWrapper,
      resolve: async (_root, _args, context, info) => ({
        user: await prisma.user.findUniqueOrThrow({
          ...queryFromInfo({ context, info }),
          where: { id: 1 },
        }),
      }),
    }),
    profileWrapper: t.prismaField({
      type: ProfileWithUser,
      resolve: (query) => {
        plannedQueries.push(query);

        return prisma.profile.findFirstOrThrow({ where: { userId: 1 } });
      },
    }),
  }),
});

const schema = builder.toSchema();

// Post has no type-level select, so the relation is planned as a whole-row include.
const nodeSelection = { id: true, email: true, posts: true };

describe('wrappers with indirect include paths', () => {
  let user: UserRow;

  beforeAll(async () => {
    user = await prisma.user.findUniqueOrThrow({ where: { id: 1 } });
    queries.length = 0;
  });

  afterEach(() => {
    queries.length = 0;
    plannedQueries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const expectedNode = {
    posts: expect.arrayContaining([{ id: expect.any(String) }]),
  };

  it("plans a same-model variant's own select alongside the node selection", async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          userSummary {
            reverseName
            node {
              email
              posts {
                id
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      userSummary: {
        reverseName: user.name?.split('').reverse().join('') ?? null,
        node: { ...expectedNode, email: user.email },
      },
    });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { select: { ...nodeSelection, name: true }, where: { id: 1 } },
      },
    ]);
  });

  it('plans nothing of its own for a wrapper without a model', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          wrapper {
            label
            node {
              email
              posts {
                id
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      wrapper: { label: 'wrapper', node: { ...expectedNode, email: user.email } },
    });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { select: nodeSelection, where: { id: 1 } },
      },
    ]);
  });

  it('plans nothing of its own for a wrapper backed by another model', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          profileWrapper {
            bio
            node {
              email
              posts {
                id
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      profileWrapper: {
        bio: expect.any(String),
        node: { ...expectedNode, email: user.email },
      },
    });
    // The query planned for the wrapper is a User query: nothing of the Profile type leaks in.
    expect(plannedQueries).toEqual([{ select: nodeSelection }]);
  });
});
