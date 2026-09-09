import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Fragments that move between an interface and its variants, or onto an interface that is not
// backed by a prisma model.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number }; viewerType?: string };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const Named = builder.interfaceRef<{ name: string | null }>('Named').implement({
  fields: (t) => ({
    displayName: t.string({ nullable: true, resolve: () => null }),
  }),
});

const Viewer = builder.prismaInterface('User', {
  variant: 'Viewer',
  select: {
    id: true,
  },
  resolveType: (_user, ctx) => ctx.viewerType ?? 'NormalViewer',
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.string({
      nullable: true,
      select: {
        profile: {
          select: {
            bio: true,
          },
        },
      },
      resolve: (user) => user.profile?.bio,
    }),
  }),
});

const NormalViewer = builder.prismaObject('User', {
  variant: 'NormalViewer',
  interfaces: () => [Viewer, Named],
  select: {
    id: true,
    name: true,
  },
  fields: (t) => ({
    displayName: t.string({
      nullable: true,
      select: {
        email: true,
      },
      resolve: (user) => user.email,
    }),
    // Relies on the type-level select; there is no field-level select to fall back on.
    reverseName: t.string({
      nullable: true,
      resolve: (user) => user.name?.split('').reverse().join(''),
    }),
  }),
});

// No type-level select: an include-mode variant of a select-mode interface.
builder.prismaObject('User', {
  variant: 'FullViewer',
  interfaces: [Viewer],
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

const PostsViewer = builder.prismaInterface('User', {
  variant: 'PostsViewer',
  select: {
    posts: {
      take: 3,
      select: {
        id: true,
      },
    },
  },
  resolveType: () => 'RecentPostsViewer',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.prismaObject('User', {
  variant: 'RecentPostsViewer',
  interfaces: [PostsViewer],
  select: {
    posts: {
      take: 1,
      select: {
        id: true,
      },
    },
  },
  fields: (t) => ({
    postCount: t.int({
      resolve: (user) => user.posts.length,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    viewer: t.prismaField({
      type: Viewer,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    normalViewer: t.prismaField({
      type: NormalViewer,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    postsViewer: t.prismaField({
      type: PostsViewer,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('fragments on variants and non-model interfaces', () => {
  let user: { email: string; name: string | null; profile: { bio: string | null } | null };

  beforeAll(async () => {
    user = await prisma.user.findUniqueOrThrow({ where: { id: 1 }, include: { profile: true } });
    queries.length = 0;
  });

  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('fragments on a non-model interface', () => {
    const expectedQueries = [
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { select: { id: true, name: true, email: true }, where: { id: 1 } },
      },
    ];

    it('plans an inline fragment on the interface like a fragment on the object', async () => {
      const onObject = await execute({
        schema,
        document: gql`
          query {
            normalViewer {
              ... on NormalViewer {
                displayName
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });
      const objectQueries = [...queries];
      queries.length = 0;

      const onInterface = await execute({
        schema,
        document: gql`
          query {
            normalViewer {
              ... on Named {
                displayName
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(onObject.errors).toBeUndefined();
      expect(onObject.data).toEqual({ normalViewer: { displayName: user.email } });
      expect(objectQueries).toEqual(expectedQueries);

      expect(onInterface.errors).toBeUndefined();
      expect(onInterface.data).toEqual(onObject.data);
      expect(queries).toEqual(objectQueries);
    });

    it('plans a fragment spread on the interface like a fragment on the object', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            normalViewer {
              ...NamedFields
            }
          }

          fragment NamedFields on Named {
            displayName
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ normalViewer: { displayName: user.email } });
      expect(queries).toEqual(expectedQueries);
    });

    it('finds fields in a fragment nested under one that does not apply to the type', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ... on Named {
                ... on Viewer {
                  bio
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { bio: user.profile?.bio ?? null } });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { select: { id: true, profile: { select: { bio: true } } }, where: { id: 1 } },
        },
      ]);
    });
  });

  describe('entering a variant through a fragment', () => {
    it("merges the variant's type-level select", async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ... on NormalViewer {
                reverseName
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        viewer: { reverseName: user.name?.split('').reverse().join('') ?? null },
      });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { select: { id: true, name: true }, where: { id: 1 } },
        },
      ]);
    });

    it('loads the whole row for a variant without a type-level select', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ... on FullViewer {
                email
              }
            }
          }
        `,
        contextValue: { user: { id: 1 }, viewerType: 'FullViewer' },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { email: user.email } });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { where: { id: 1 } },
        },
      ]);
    });

    it('rejects type-level selects with conflicting relation arguments', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            postsViewer {
              ... on RecentPostsViewer {
                postCount
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors?.[0]?.message).toBe(
        'Type-level selections of PostsViewer and RecentPostsViewer conflict on relation "posts". Move the relation arguments to a field-level select on one of the types.',
      );
    });
  });

  describe('fragments left out by @skip / @include', () => {
    it('does not enter a variant through a skipped inline fragment', async () => {
      const result = await execute({
        schema,
        document: gql`
          query ($skip: Boolean!) {
            postsViewer {
              id
              ... on RecentPostsViewer @skip(if: $skip) {
                postCount
              }
            }
          }
        `,
        variableValues: { skip: true },
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ postsViewer: { id: '1' } });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: {
            select: { id: true, posts: { take: 3, select: { id: true } } },
            where: { id: 1 },
          },
        },
      ]);
    });

    it('leaves the fields of an excluded fragment spread out of the query', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              id
              ...NormalViewerFields @include(if: false)
            }
          }

          fragment NormalViewerFields on NormalViewer {
            displayName
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { id: '1' } });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { select: { id: true }, where: { id: 1 } },
        },
      ]);
    });
  });
});
