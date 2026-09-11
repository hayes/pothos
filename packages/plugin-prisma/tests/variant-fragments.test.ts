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
    // A field-level select whose relation arguments conflict with LatestPostViewer's type-level
    // select.
    recentPostIds: t.idList({
      select: {
        posts: {
          take: 3,
          select: {
            id: true,
          },
        },
      },
      resolve: (user) => user.posts.map((post) => post.id),
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

// Type-level relation arguments that conflict with Viewer.recentPostIds's field-level select.
builder.prismaObject('User', {
  variant: 'LatestPostViewer',
  interfaces: [Viewer],
  select: {
    id: true,
    posts: {
      take: 1,
      select: {
        id: true,
      },
    },
  },
  fields: (t) => ({
    latestPostId: t.id({
      nullable: true,
      resolve: (user) => user.posts[0]?.id,
    }),
  }),
});

// A second variant of Viewer whose type-level select conflicts with LatestPostViewer's.
builder.prismaObject('User', {
  variant: 'PostPairViewer',
  interfaces: [Viewer],
  select: {
    id: true,
    posts: {
      take: 2,
      select: {
        id: true,
      },
    },
  },
  fields: (t) => ({
    postPairIds: t.idList({
      resolve: (user) => user.posts.map((post) => post.id),
    }),
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

  describe('a fragment spread more than once', () => {
    it('plans a deep chain of repeated spreads like the fragment it ends in', async () => {
      // F1 spreads F2 twice, F2 spreads F3 twice, and so on: 2^11 spreads reach F12.
      const fragments: string[] = [];

      for (let i = 1; i < 12; i += 1) {
        fragments.push(`fragment F${i} on Viewer { ...F${i + 1} ...F${i + 1} }`);
      }

      fragments.push('fragment F12 on Viewer { ... on NormalViewer { reverseName } }');

      const started = performance.now();
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ...F1
            }
          }
          ${fragments.join('\n')}
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(performance.now() - started).toBeLessThan(1000);
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
  });

  describe('a field selected more than once', () => {
    // graphql merges both `viewer` selections into one `info.fieldNodes`.
    const variantLater = gql`
      query {
        viewer {
          id
        }
        ...More
      }

      fragment More on Query {
        viewer {
          ... on NormalViewer {
            reverseName
          }
        }
      }
    `;
    const variantFirst = gql`
      query {
        ...More
        viewer {
          id
        }
      }

      fragment More on Query {
        viewer {
          ... on NormalViewer {
            reverseName
          }
        }
      }
    `;

    it("merges a variant's type-level select from either occurrence of the field", async () => {
      for (const document of [variantLater, variantFirst]) {
        const result = await execute({ schema, document, contextValue: { user: { id: 1 } } });

        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          viewer: { id: '1', reverseName: user.name?.split('').reverse().join('') ?? null },
        });
        // The variant's `name` is loaded in the one query.
        expect(queries).toEqual([
          {
            action: 'findUniqueOrThrow',
            model: 'User',
            args: { select: { id: true, name: true }, where: { id: 1 } },
          },
        ]);
        queries.length = 0;
      }
    });
  });

  describe('type-level selections are merged before fields', () => {
    const fieldFirst = gql`
      query {
        viewer {
          recentPostIds
          ... on LatestPostViewer {
            latestPostId
          }
        }
      }
    `;
    const fragmentFirst = gql`
      query {
        viewer {
          ... on LatestPostViewer {
            latestPostId
          }
          recentPostIds
        }
      }
    `;

    it('lets a conflicting field-level select fall back whichever side of the fragment it is on', async () => {
      const posts = await prisma.post.findMany({ where: { authorId: 1 }, take: 3 });
      queries.length = 0;

      for (const document of [fieldFirst, fragmentFirst]) {
        const result = await execute({
          schema,
          document,
          contextValue: { user: { id: 1 }, viewerType: 'LatestPostViewer' },
        });

        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          viewer: {
            recentPostIds: posts.map((post) => String(post.id)),
            latestPostId: String(posts[0].id),
          },
        });
        // The variant's type-level select is planned; the field loads its own posts.
        expect(queries).toEqual([
          {
            action: 'findUniqueOrThrow',
            model: 'User',
            args: {
              select: { id: true, posts: { take: 1, select: { id: true } } },
              where: { id: 1 },
            },
          },
          {
            action: 'findUniqueOrThrow',
            model: 'User',
            args: {
              select: { id: true, posts: { take: 3, select: { id: true } } },
              where: { id: 1 },
            },
          },
        ]);
        queries.length = 0;
      }
    });

    it('rejects conflicting type-level selections whichever fragment comes first', async () => {
      const documents = [
        gql`
          query {
            viewer {
              ... on LatestPostViewer {
                latestPostId
              }
              ... on PostPairViewer {
                postPairIds
              }
            }
          }
        `,
        gql`
          query {
            viewer {
              ... on PostPairViewer {
                postPairIds
              }
              ... on LatestPostViewer {
                latestPostId
              }
            }
          }
        `,
      ];

      for (const document of documents) {
        const result = await execute({ schema, document, contextValue: { user: { id: 1 } } });

        expect(result.errors?.[0]?.message).toMatch(
          /^Type-level selections of Viewer and (LatestPostViewer|PostPairViewer) conflict on relation "posts"\./,
        );
      }
    });
  });

  describe('sibling variants under a concrete field type', () => {
    it('does not enter same-model objects nested under a fragment on their interface', async () => {
      const posts = await prisma.post.findMany({ where: { authorId: 1 }, take: 3 });
      queries.length = 0;

      // normalViewer can never resolve as LatestPostViewer or PostPairViewer, so neither
      // type-level select is merged: the two do not conflict, and recentPostIds is planned.
      const result = await execute({
        schema,
        document: gql`
          query {
            normalViewer {
              recentPostIds
              ... on Viewer {
                ... on LatestPostViewer {
                  latestPostId
                }
                ... on PostPairViewer {
                  postPairIds
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        normalViewer: { recentPostIds: posts.map((post) => String(post.id)) },
      });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: {
            select: { id: true, name: true, posts: { take: 3, select: { id: true } } },
            where: { id: 1 },
          },
        },
      ]);
    });
  });
});
