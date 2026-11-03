import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { parse } from 'graphql';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

const argsOf = (logged: unknown[]) => logged.map((query) => (query as { args: unknown }).args);

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
    // No select: NormalViewer loads `name` through its type-level select.
    name: t.string({ nullable: true, resolve: (named) => named.name }),
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

let countedSelectCalls = 0;

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
    // Counts how often its select runs.
    countedName: t.string({
      nullable: true,
      select: () => {
        countedSelectCalls += 1;

        return { name: true };
      },
      resolve: (user) => user.name,
    }),
  }),
});

// Implemented by LatestPostViewer and PostPairViewer, whose type-level selects conflict.
const Tagged = builder.interfaceRef<{ id: number }>('Tagged').implement({
  fields: (t) => ({
    tag: t.string({ resolve: (user) => `tag-${user.id}` }),
  }),
});

// Implemented only by LatestPostViewer, whose type-level select conflicts with
// Viewer.recentPostIds. Relay compilers add `... on Node { id }` to a selection like this one.
const Stamped = builder.interfaceRef<object>('Stamped').implement({
  fields: (t) => ({
    stamp: t.string({ resolve: () => 'stamped' }),
  }),
});

// Fields with no select that read the row a variant's type-level select loaded, implemented only by
// LabeledViewer, whose relation arguments conflict with Viewer.recentPostIds.
const Labeled = builder
  .interfaceRef<{ name: string | null; posts?: unknown[] }>('Labeled')
  .implement({
    fields: (t) => ({
      label: t.string({ nullable: true, resolve: (user) => user.name }),
      latestCount: t.int({ nullable: true, resolve: (user) => user.posts?.length }),
    }),
  });

builder.prismaObject('User', {
  variant: 'LabeledViewer',
  interfaces: [Viewer, Labeled],
  select: {
    id: true,
    name: true,
    posts: {
      take: 1,
      select: {
        id: true,
      },
    },
  },
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
  interfaces: [Viewer, Tagged, Stamped],
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
    // Overrides Stamped.stamp with a select of its own, so a reload can answer it.
    stamp: t.string({ select: { id: true }, resolve: (user) => `stamped-${user.id}` }),
  }),
});

// A second variant of Viewer whose type-level select conflicts with LatestPostViewer's.
builder.prismaObject('User', {
  variant: 'PostPairViewer',
  interfaces: [Viewer, Tagged],
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

// Model interfaces with relations back to each other, each implemented by three variants that also
// implement a non-model interface: every level of a document can expand under `... on Linked`.
const Linked = builder.interfaceRef<object>('Linked').implement({
  fields: (t) => ({
    linked: t.string({ resolve: () => 'linked' }),
  }),
});

let relationQueryCalls = 0;

const relationQuery = () => {
  relationQueryCalls += 1;

  return { take: 1 };
};

const CyclicUser = builder.prismaInterface('User', {
  variant: 'CyclicUser',
  select: { id: true },
  resolveType: () => 'CyclicUser1',
  fields: (t) => ({ userId: t.exposeID('id') }),
});

const CyclicPost = builder.prismaInterface('Post', {
  variant: 'CyclicPost',
  select: { id: true },
  resolveType: () => 'CyclicPost1',
  fields: (t) => ({ postId: t.exposeID('id') }),
});

builder.prismaInterfaceField(CyclicUser, 'posts', (t) =>
  t.relation('posts', { type: CyclicPost, query: relationQuery }),
);
builder.prismaInterfaceField(CyclicPost, 'author', (t) =>
  t.relation('author', { type: CyclicUser }),
);

for (const n of [1, 2, 3]) {
  builder.prismaObject('User', {
    variant: `CyclicUser${n}`,
    interfaces: [CyclicUser, Linked],
    select: { id: true },
  });
  builder.prismaObject('Post', {
    variant: `CyclicPost${n}`,
    interfaces: [CyclicPost, Linked],
    select: { id: true },
  });
}

builder.queryType({
  fields: (t) => ({
    cyclicUser: t.prismaField({
      type: CyclicUser,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    viewers: t.prismaField({
      type: [Viewer],
      resolve: (query) => prisma.user.findMany({ ...query, take: 3 }),
    }),
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

    it("loads a field without a select of its own through the variant's type-level select", async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ...NamedFields
            }
          }

          fragment NamedFields on Named {
            name
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { name: user.name } });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { select: { id: true, name: true }, where: { id: 1 } },
        },
      ]);
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
      // Named covers NormalViewer alone, so bio is planned for NormalViewer rows, with its
      // type-level select.
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: {
            select: { id: true, name: true, profile: { select: { bio: true } } },
            where: { id: 1 },
          },
        },
      ]);
    });
  });

  describe('a fragment on a non-model interface whose implementations conflict', () => {
    it('does not fail a query whose fragment covers conflicting implementations', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              id
              ... on Tagged {
                tag
              }
            }
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

    it('resolves the fragment beside a fragment on one of the implementations', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ... on Tagged {
                tag
                ... on LatestPostViewer {
                  latestPostId
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 }, viewerType: 'LatestPostViewer' },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { tag: 'tag-1', latestPostId: expect.any(String) } });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: {
            select: { id: true, posts: { take: 1, select: { id: true } } },
            where: { id: 1 },
          },
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

      fragments.push('fragment F12 on Viewer { ... on NormalViewer { reverseName countedName } }');

      countedSelectCalls = 0;
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

      expect(result.errors).toBeUndefined();
      // F12's select runs once, not once per spread that reaches it.
      expect(countedSelectCalls).toBe(1);
      expect(result.data).toEqual({
        viewer: {
          reverseName: user.name?.split('').reverse().join('') ?? null,
          countedName: user.name,
        },
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

  describe('fragments on a non-model interface at every level of a cyclic document', () => {
    /** Each of `depth` relation levels selected through `... on Linked`. */
    function cyclicDocument(depth: number) {
      let selection = '... on Linked { linked }';

      for (let level = depth; level >= 1; level -= 1) {
        selection =
          level % 2 === 1
            ? `... on Linked { ... on CyclicUser { posts { ${selection} } } }`
            : `... on Linked { ... on CyclicPost { author { ${selection} } } }`;
      }

      return parse(`{ cyclicUser { ${selection} } }`);
    }

    /** One named fragment per level, selecting the relation beneath each of the three variants. */
    function namedDocument(root: string, depth: number) {
      const fragments: string[] = [];

      for (let level = 1; level <= depth; level += 1) {
        const next = level === depth ? '... on Linked { linked }' : `...L${level + 1}`;
        const selections = [1, 2, 3].map((n) =>
          level % 2 === 1
            ? `... on CyclicUser${n} { posts { ${next} } }`
            : `... on CyclicPost${n} { author { ${next} } }`,
        );

        fragments.push(`fragment L${level} on Linked { ${selections.join(' ')} }`);
      }

      return parse(`{ ${root} { ...L1 } } ${fragments.join(' ')}`);
    }

    it('walks each relation once per type it is reached on, not once per path', async () => {
      const callsAt = async (depth: number) => {
        relationQueryCalls = 0;
        queries.length = 0;

        const result = await execute({
          schema,
          document: cyclicDocument(depth),
          contextValue: { user: { id: 1 } },
        });

        expect(result.errors).toBeUndefined();
        expect(queries).toHaveLength(1);

        return relationQueryCalls;
      };

      // Only `posts` counts: the interface and its three variants, at each of the odd levels.
      // Exponential planning made these 1,092 calls at depth 6 and 4,473,924 at depth 12.
      expect(await callsAt(6)).toBe(12);
      expect(await callsAt(12)).toBe(24);
    });

    it('walks a named fragment spread beneath every variant once per level', async () => {
      const callsAt = async (depth: number) => {
        relationQueryCalls = 0;
        queries.length = 0;

        const result = await execute({
          schema,
          document: namedDocument('cyclicUser', depth),
          contextValue: { user: { id: 1 } },
        });

        expect(result.errors).toBeUndefined();
        expect(queries).toHaveLength(1);

        return relationQueryCalls;
      };

      // Each of the three `posts` nodes, by the plain walk and the expanding one, at each odd
      // level. A walk per field node made these 4,920 calls at depth 8.
      expect(await callsAt(8)).toBe(24);
      expect(await callsAt(20)).toBe(60);
    });

    it('plans the same query with and without the fragments', async () => {
      const withFragments = await execute({
        schema,
        document: cyclicDocument(2),
        contextValue: { user: { id: 1 } },
      });
      const fragmentQueries = [...queries];

      queries.length = 0;

      const without = await execute({
        schema,
        document: gql`
          query {
            cyclicUser {
              ... on CyclicUser1 {
                linked
              }
              posts {
                ... on CyclicPost1 {
                  linked
                }
                author {
                  userId
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(without.errors).toBeUndefined();
      expect(withFragments.errors).toBeUndefined();
      expect(argsOf(fragmentQueries)).toEqual(argsOf(queries));
    });
  });

  describe('a fragment that would cost a field its place in the parent query', () => {
    const recentPosts = { posts: { take: 3, select: { id: true } }, id: true };

    it('does not reload a field because of a variant only the fragment entered', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              recentPostIds
              ... on Stamped {
                stamp
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { recentPostIds: expect.any(Array) } });
      expect(argsOf(queries)).toEqual([{ select: recentPosts, where: { id: 1 } }]);
    });

    it('stays one statement for a list of rows', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewers {
              recentPostIds
              ... on Stamped {
                stamp
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.viewers).toHaveLength(3);
      expect(argsOf(queries)).toEqual([{ select: recentPosts, take: 3 }]);
    });

    it('keeps the expansion when the fragment holds a field with no select', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              recentPostIds
              ... on Labeled {
                label
                latestCount
              }
            }
          }
        `,
        contextValue: { user: { id: 1 }, viewerType: 'LabeledViewer' },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        viewer: {
          recentPostIds: expect.objectContaining({ length: 3 }),
          label: user.name,
          latestCount: 1,
        },
      });
      expect(queries).toHaveLength(2);
    });

    it('still expands the fragment when no field is displaced', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ... on Stamped {
                stamp
              }
            }
          }
        `,
        contextValue: { user: { id: 1 }, viewerType: 'LatestPostViewer' },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { stamp: 'stamped-1' } });
      expect(argsOf(queries)).toEqual([
        { select: { posts: { take: 1, select: { id: true } }, id: true }, where: { id: 1 } },
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
