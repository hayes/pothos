import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import type { SQLOperator } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';
import type { users } from './example/db/schema';

// Fragments that move between an interface and its variants, or onto an interface that is not
// backed by a drizzle table.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { user: { id: number }; viewerType?: string };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

const Named = builder.interfaceRef<{ firstName: string | null }>('Named').implement({
  fields: (t) => ({
    displayName: t.string({ nullable: true, resolve: () => null }),
  }),
});

const Viewer = builder.drizzleInterface('users', {
  variant: 'Viewer',
  select: {
    columns: {
      id: true,
    },
  },
  resolveType: (_user, ctx) => ctx.viewerType ?? 'NormalViewer',
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.string({
      select: {
        columns: {
          username: true,
        },
      },
      resolve: (user) => `@${user.username}`,
    }),
    // A field-level select whose relation arguments conflict with LatestPostViewer's type-level
    // select.
    recentPostIds: t.idList({
      select: {
        with: {
          posts: {
            limit: 3,
            columns: {
              postId: true,
            },
          },
        },
      },
      resolve: (user) => user.posts.map((post) => post.postId),
    }),
  }),
});

const NormalViewer = builder.drizzleObject('users', {
  variant: 'NormalViewer',
  interfaces: () => [Viewer, Named],
  select: {
    columns: {
      id: true,
      firstName: true,
    },
  },
  fields: (t) => ({
    displayName: t.string({
      nullable: true,
      select: {
        columns: {
          lastName: true,
        },
      },
      resolve: (user) => user.lastName,
    }),
    // Relies on the type-level select; there is no field-level select to fall back on.
    reverseFirstName: t.string({
      nullable: true,
      resolve: (user) => user.firstName?.split('').reverse().join(''),
    }),
  }),
});

// No type-level select: a variant selecting every column, under an interface that does not.
builder.drizzleObject('users', {
  variant: 'FullViewer',
  interfaces: [Viewer],
  fields: (t) => ({
    lastName: t.exposeString('lastName', { nullable: true }),
  }),
});

// Type-level relation arguments that conflict with Viewer.recentPostIds's field-level select.
builder.drizzleObject('users', {
  variant: 'LatestPostViewer',
  interfaces: [Viewer],
  select: {
    columns: {
      id: true,
    },
    with: {
      posts: {
        limit: 1,
        columns: {
          postId: true,
        },
      },
    },
  },
  fields: (t) => ({
    latestPostId: t.id({
      nullable: true,
      resolve: (user) => user.posts[0]?.postId,
    }),
  }),
});

// A second variant of Viewer whose type-level select conflicts with LatestPostViewer's.
builder.drizzleObject('users', {
  variant: 'PostPairViewer',
  interfaces: [Viewer],
  select: {
    columns: {
      id: true,
    },
    with: {
      posts: {
        limit: 2,
        columns: {
          postId: true,
        },
      },
    },
  },
  fields: (t) => ({
    postPairIds: t.idList({
      resolve: (user) => user.posts.map((post) => post.postId),
    }),
  }),
});

const PostsViewer = builder.drizzleInterface('users', {
  variant: 'PostsViewer',
  select: {
    with: {
      posts: {
        limit: 3,
      },
    },
  },
  resolveType: () => 'RecentPostsViewer',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.drizzleObject('users', {
  variant: 'RecentPostsViewer',
  interfaces: [PostsViewer],
  select: {
    with: {
      posts: {
        limit: 1,
      },
    },
  },
  fields: (t) => ({
    postCount: t.int({
      resolve: (user) => user.posts.length,
    }),
  }),
});

// Extras are compared by identity: two types defining the same extra must share the function.
const lowercaseFirstName = (user: typeof users, { sql }: SQLOperator) =>
  sql<string>`lower(${user.firstName})`;
const uppercaseFirstName = (user: typeof users, { sql }: SQLOperator) =>
  sql<string>`upper(${user.firstName})`;

const NamedViewer = builder.drizzleInterface('users', {
  variant: 'NamedViewer',
  select: {
    columns: {
      id: true,
    },
    extras: {
      casedFirstName: lowercaseFirstName,
    },
  },
  resolveType: () => 'LowercaseViewer',
  fields: (t) => ({
    casedFirstName: t.string({
      resolve: (user) => user.casedFirstName,
    }),
  }),
});

// The same extra through the same function: compatible.
builder.drizzleObject('users', {
  variant: 'LowercaseViewer',
  interfaces: [NamedViewer],
  select: {
    columns: {
      id: true,
    },
    extras: {
      casedFirstName: lowercaseFirstName,
    },
  },
  fields: (t) => ({
    shoutedFirstName: t.string({
      resolve: (user) => user.casedFirstName.toUpperCase(),
    }),
  }),
});

// The same extra through another function: a conflict.
builder.drizzleObject('users', {
  variant: 'UppercaseViewer',
  interfaces: [NamedViewer],
  select: {
    columns: {
      id: true,
    },
    extras: {
      casedFirstName: uppercaseFirstName,
    },
  },
});

builder.queryType({
  fields: (t) => ({
    namedViewer: t.drizzleField({
      type: NamedViewer,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    viewer: t.drizzleField({
      type: Viewer,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    normalViewer: t.drizzleField({
      type: NormalViewer,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    postsViewer: t.drizzleField({
      type: PostsViewer,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('fragments on variants and non-model interfaces', () => {
  let user: { firstName: string | null; lastName: string | null };

  beforeAll(async () => {
    user = (await db.query.users.findFirst({ where: { id: 1 } }))!;
    clearDrizzleLogs();
  });

  afterEach(() => {
    clearDrizzleLogs();
  });

  describe('fragments on a non-model interface', () => {
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
      const objectLogs = [...drizzleLogs];
      clearDrizzleLogs();

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
      expect(onObject.data).toEqual({ normalViewer: { displayName: user.lastName } });
      expect(objectLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);

      expect(onInterface.errors).toBeUndefined();
      expect(onInterface.data).toEqual(onObject.data);
      expect(drizzleLogs).toEqual(objectLogs);
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
      expect(result.data).toEqual({ normalViewer: { displayName: user.lastName } });
      expect(drizzleLogs).toHaveLength(1);
      expect(drizzleLogs[0]).toContain('"last_name"');
    });

    it('finds fields in a fragment nested under one that does not apply to the type', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ... on Named {
                ... on Viewer {
                  username
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { username: expect.stringMatching(/^@./) } });
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."username" as "username" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
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
                reverseFirstName
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        viewer: { reverseFirstName: user.firstName?.split('').reverse().join('') ?? null },
      });
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
    });

    it('loads every column for a variant without a type-level select', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              ... on FullViewer {
                lastName
              }
            }
          }
        `,
        contextValue: { user: { id: 1 }, viewerType: 'FullViewer' },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { lastName: user.lastName } });
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
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
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id" limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [3, 1, 1]",
        ]
      `);
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
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
    });
  });

  describe('a fragment spread more than once', () => {
    it('plans a deep chain of repeated spreads like the fragment it ends in', async () => {
      // F1 spreads F2 twice, F2 spreads F3 twice, and so on: 2^11 spreads reach F12.
      const fragments: string[] = [];

      for (let i = 1; i < 12; i += 1) {
        fragments.push(`fragment F${i} on Viewer { ...F${i + 1} ...F${i + 1} }`);
      }

      fragments.push('fragment F12 on Viewer { ... on NormalViewer { reverseFirstName } }');

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
        viewer: { reverseFirstName: user.firstName?.split('').reverse().join('') ?? null },
      });
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
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
            reverseFirstName
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
            reverseFirstName
          }
        }
      }
    `;

    it("merges a variant's type-level select from either occurrence of the field", async () => {
      const logs: string[][] = [];

      for (const document of [variantLater, variantFirst]) {
        const result = await execute({ schema, document, contextValue: { user: { id: 1 } } });

        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          viewer: {
            id: '1',
            reverseFirstName: user.firstName?.split('').reverse().join('') ?? null,
          },
        });
        logs.push([...drizzleLogs]);
        clearDrizzleLogs();
      }

      expect(logs[1]).toEqual(logs[0]);
      // The variant's `firstName` is loaded in the one query.
      expect(logs[0]).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
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
      const posts = await db.query.posts.findMany({ where: { authorId: 1 }, limit: 3 });
      clearDrizzleLogs();

      const logs: string[][] = [];

      for (const document of [fieldFirst, fragmentFirst]) {
        const result = await execute({
          schema,
          document,
          contextValue: { user: { id: 1 }, viewerType: 'LatestPostViewer' },
        });

        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          viewer: {
            recentPostIds: posts.map((post) => String(post.postId)),
            latestPostId: String(posts[0].postId),
          },
        });
        logs.push([...drizzleLogs]);
        clearDrizzleLogs();
      }

      expect(logs[1]).toEqual(logs[0]);
      // The variant's type-level select is planned; the field loads its own posts.
      expect(logs[0]).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
          "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [3, 1]",
        ]
      `);
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

  describe('extras in type-level selections', () => {
    it('merges a variant defining the same extra through the same function', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            namedViewer {
              casedFirstName
              ... on LowercaseViewer {
                shoutedFirstName
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        namedViewer: {
          casedFirstName: user.firstName?.toLowerCase(),
          shoutedFirstName: user.firstName?.toUpperCase(),
        },
      });
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", (lower("d0"."first_name")) as "casedFirstName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
    });

    it('rejects a variant defining the same extra through another function', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            namedViewer {
              ... on UppercaseViewer {
                casedFirstName
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors?.[0]?.message).toBe(
        'Type-level selections of NamedViewer and UppercaseViewer conflict on extra "casedFirstName". Define the extra with the same function on both types, or move it to a field-level select on one of the types.',
      );
    });
  });
});
