import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import type { SQLOperator } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { parse } from 'graphql';
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
    // No select: NormalViewer loads `firstName` through its type-level select.
    firstName: t.string({ nullable: true, resolve: (named) => named.firstName }),
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
  .interfaceRef<{ firstName: string | null; posts?: unknown[] }>('Labeled')
  .implement({
    fields: (t) => ({
      label: t.string({ nullable: true, resolve: (user) => user.firstName }),
      latestCount: t.int({ nullable: true, resolve: (user) => user.posts?.length }),
    }),
  });

builder.drizzleObject('users', {
  variant: 'LabeledViewer',
  interfaces: [Viewer, Labeled],
  select: {
    columns: {
      id: true,
      firstName: true,
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
  interfaces: [Viewer, Tagged, Stamped],
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
    // Overrides Stamped.stamp with a select of its own, so a reload can answer it.
    stamp: t.string({ select: { columns: { id: true } }, resolve: (user) => `stamped-${user.id}` }),
  }),
});

// A second variant of Viewer whose type-level select conflicts with LatestPostViewer's.
builder.drizzleObject('users', {
  variant: 'PostPairViewer',
  interfaces: [Viewer, Tagged],
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

  return { limit: 1 };
};

const CyclicUser = builder.drizzleInterface('users', {
  variant: 'CyclicUser',
  select: { columns: { id: true } },
  resolveType: () => 'CyclicUser1',
  fields: (t) => ({ userId: t.exposeID('id') }),
});

const CyclicPost = builder.drizzleInterface('posts', {
  variant: 'CyclicPost',
  select: { columns: { postId: true } },
  resolveType: () => 'CyclicPost1',
  fields: (t) => ({ postId: t.exposeID('postId') }),
});

builder.drizzleInterfaceField(CyclicUser, 'posts', (t) =>
  t.relation('posts', { type: CyclicPost, query: relationQuery }),
);
builder.drizzleInterfaceField(CyclicPost, 'author', (t) =>
  t.relation('author', { type: CyclicUser }),
);

for (const n of [1, 2, 3]) {
  builder.drizzleObject('users', {
    variant: `CyclicUser${n}`,
    interfaces: [CyclicUser, Linked],
    select: { columns: { id: true } },
  });
  builder.drizzleObject('posts', {
    variant: `CyclicPost${n}`,
    interfaces: [CyclicPost, Linked],
    select: { columns: { postId: true } },
  });
}

builder.queryType({
  fields: (t) => ({
    cyclicUser: t.drizzleField({
      type: CyclicUser,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    // Plans without loading, for a document too deep for SQLite to join.
    plannedCyclicUser: t.drizzleField({
      type: CyclicUser,
      nullable: true,
      resolve: (query) => {
        query({ where: { id: 1 } });

        return null;
      },
    }),
    viewers: t.drizzleField({
      type: [Viewer],
      resolve: (query) => db.query.users.findMany(query({ limit: 3 })),
    }),
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
            firstName
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ viewer: { firstName: user.firstName } });
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
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
      // Named covers NormalViewer alone, so username is planned for NormalViewer rows, with its
      // type-level select.
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName", "d0"."username" as "username" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
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
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
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
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", (select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" limit ?) as "t") as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
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
          "Query: select "d0"."id" as "id", (select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id" limit ?) as "t") as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [3, 1, 1]",
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

  describe('fragments on a non-model interface at every level of a cyclic document', () => {
    /** Each of `depth` relation levels selected through `... on Linked`. */
    function cyclicDocument(root: string, depth: number) {
      let selection = '... on Linked { linked }';

      for (let level = depth; level >= 1; level -= 1) {
        selection =
          level % 2 === 1
            ? `... on Linked { ... on CyclicUser { posts { ${selection} } } }`
            : `... on Linked { ... on CyclicPost { author { ${selection} } } }`;
      }

      return parse(`{ ${root} { ${selection} } }`);
    }

    it('walks each relation once per type it is reached on, not once per path', async () => {
      const callsAt = async (depth: number) => {
        relationQueryCalls = 0;

        const started = performance.now();
        const result = await execute({
          schema,
          document: cyclicDocument('plannedCyclicUser', depth),
          contextValue: { user: { id: 1 } },
        });

        expect(performance.now() - started).toBeLessThan(1000);
        expect(result.errors).toBeUndefined();

        return relationQueryCalls;
      };

      // Only `posts` counts: the interface and its three variants, at each of the odd levels.
      // Exponential planning made these 1,092 calls at depth 6 and 4,473,924 at depth 12.
      expect(await callsAt(6)).toBe(12);
      expect(await callsAt(12)).toBe(24);
    });

    it('loads a shared walk in one statement', async () => {
      const result = await execute({
        schema,
        document: cyclicDocument('cyclicUser', 4),
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(drizzleLogs).toHaveLength(1);
    });
  });

  describe('a fragment that would cost a field its place in the parent query', () => {
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
      expect(drizzleLogs).toHaveLength(1);
      expect(drizzleLogs[0]).toContain('limit ?');
      expect(drizzleLogs[0]).toContain('params: [3,');
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
      expect(drizzleLogs).toHaveLength(1);
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
          label: user.firstName,
          latestCount: 1,
        },
      });
      expect(drizzleLogs).toHaveLength(2);
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
      expect(drizzleLogs).toHaveLength(1);
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
          "Query: select "d0"."id" as "id", (select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" limit ?) as "t") as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
          "Query: select "d0"."id" as "id", (select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" limit ?) as "t") as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [3, 1]",
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
