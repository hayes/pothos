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

let countedSelectCalls = 0;

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
    // Counts how often its select runs.
    countedFirstName: t.string({
      nullable: true,
      select: () => {
        countedSelectCalls += 1;

        return { columns: { firstName: true } };
      },
      resolve: (user) => user.firstName,
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

// A query that branches on where it is loaded, beneath a fragment spread on two variants.
const branchPaths: string[][] = [];

const BranchPost = builder.drizzleObject('posts', {
  name: 'BranchPost',
  fields: (t) => ({ id: t.exposeID('postId') }),
});

const BranchUser = builder.drizzleObject('users', {
  name: 'BranchUser',
  fields: (t) => ({
    posts: t.relation('posts', {
      type: BranchPost,
      query: (_args, _ctx, path) => {
        branchPaths.push(path!.path);

        return path!.path.includes('FeatureItem.author')
          ? { limit: 1, orderBy: { postId: 'desc' } }
          : { limit: 2, orderBy: { postId: 'asc' } };
      },
    }),
  }),
});

const Item = builder.drizzleInterface('posts', {
  variant: 'Item',
  select: { columns: { postId: true } },
  resolveType: (post) => (post.postId % 2 ? 'BugItem' : 'FeatureItem'),
  fields: (t) => ({
    author: t.relation('author', { type: BranchUser }),
  }),
});

builder.drizzleObject('posts', { variant: 'BugItem', interfaces: [Item] });
builder.drizzleObject('posts', { variant: 'FeatureItem', interfaces: [Item] });

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

// The same relations through a field's own select function.
let selectCalls = 0;

builder.drizzleInterfaceField(CyclicUser, 'selectedPosts', (t) =>
  t.field({
    type: [CyclicPost],
    select: (_args, _ctx, nestedSelection) => {
      selectCalls += 1;

      return { with: { posts: nestedSelection({ limit: 1 }) } };
    },
    resolve: (user) => user.posts,
  }),
);
builder.drizzleInterfaceField(CyclicPost, 'selectedAuthor', (t) =>
  t.field({
    type: CyclicUser,
    select: (_args, _ctx, nestedSelection) => {
      selectCalls += 1;

      return { with: { author: nestedSelection() } };
    },
    resolve: (post) => post.author!,
  }),
);

// A select function that reads the path from its nested selection function.
const selectPaths: string[][] = [];

builder.drizzleInterfaceField(CyclicUser, 'pathPosts', (t) =>
  t.field({
    type: [CyclicPost],
    select: (_args, _ctx, nestedSelection) => {
      selectPaths.push(nestedSelection.path);

      return { with: { posts: nestedSelection({ limit: 1 }) } };
    },
    resolve: (user) => user.posts,
  }),
);
builder.drizzleInterfaceField(CyclicPost, 'pathAuthor', (t) =>
  t.field({
    type: CyclicUser,
    select: (_args, _ctx, nestedSelection) => {
      selectPaths.push(nestedSelection.path);

      return { with: { author: nestedSelection() } };
    },
    resolve: (post) => post.author!,
  }),
);

// A relation query that reads its path.
const queryPaths: string[][] = [];

builder.drizzleInterfaceField(CyclicUser, 'pathRelPosts', (t) =>
  t.relation('posts', {
    type: CyclicPost,
    query: (_args, _ctx, path) => {
      queryPaths.push(path!.path);

      return { limit: 1 };
    },
  }),
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
    items: t.drizzleField({
      type: [Item],
      resolve: (query) =>
        db.query.posts.findMany(
          query({ where: { postId: { lte: 2 } }, orderBy: { postId: 'asc' } }),
        ),
    }),
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
    it('fails the query, as fragments naming the implementations do', async () => {
      const documents = [
        gql`
          query {
            viewer {
              id
              ... on Tagged {
                tag
              }
            }
          }
        `,
        gql`
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
      ];

      for (const document of documents) {
        const result = await execute({
          schema,
          document,
          contextValue: { user: { id: 1 }, viewerType: 'LatestPostViewer' },
        });

        expect(result.errors?.[0]?.message).toBe('Unexpected error.');
        expect((result.errors?.[0]?.originalError?.cause as Error).message).toBe(
          'Type-level selections of Viewer and PostPairViewer conflict on relation "posts". Move the relation arguments to a field-level select on one of the types.',
        );
        expect(drizzleLogs).toEqual([]);
      }
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

      expect(result.errors?.[0]?.message).toBe('Unexpected error.');
      expect((result.errors?.[0]?.originalError?.cause as Error).message).toBe(
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

      fragments.push(
        'fragment F12 on Viewer { ... on NormalViewer { reverseFirstName countedFirstName } }',
      );

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
          reverseFirstName: user.firstName?.split('').reverse().join('') ?? null,
          countedFirstName: user.firstName,
        },
      });
      expect(drizzleLogs).toMatchInlineSnapshot(`
        [
          "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        ]
      `);
    });
  });

  describe('fragments on a non-model interface at every level of a cyclic document', () => {
    /** Each of `depth` relation levels selected through `... on Linked`, or without it. */
    function cyclicDocument(
      root: string,
      depth: number,
      [posts, author] = ['posts', 'author'],
      { linked = true, leaf = '... on Linked { linked }' } = {},
    ) {
      const through = (selection: string) =>
        linked ? `... on Linked { ${selection} }` : selection;
      let selection = leaf;

      for (let level = depth; level >= 1; level -= 1) {
        selection =
          level % 2 === 1
            ? through(`... on CyclicUser { ${posts} { ${selection} } }`)
            : through(`... on CyclicPost { ${author} { ${selection} } }`);
      }

      return parse(`{ ${root} { ${selection} } }`);
    }

    /** One named fragment per level, selecting the relation beneath each of the three variants. */
    function namedDocument(
      root: string,
      depth: number,
      [posts, author] = ['posts', 'author'],
      variants = [1, 2, 3],
    ) {
      const fragments: string[] = [];

      for (let level = 1; level <= depth; level += 1) {
        const next = level === depth ? '... on Linked { linked }' : `...L${level + 1}`;
        const selections = variants.map((n) =>
          level % 2 === 1
            ? `... on CyclicUser${n} { ${posts} { ${next} } }`
            : `... on CyclicPost${n} { ${author} { ${next} } }`,
        );

        fragments.push(`fragment L${level} on Linked { ${selections.join(' ')} }`);
      }

      return parse(`{ ${root} { ...L1 } } ${fragments.join(' ')}`);
    }

    it('walks each relation once per type it is reached on, not once per path', async () => {
      const callsAt = async (depth: number) => {
        relationQueryCalls = 0;

        const result = await execute({
          schema,
          document: cyclicDocument('plannedCyclicUser', depth),
          contextValue: { user: { id: 1 } },
        });

        expect(result.errors).toBeUndefined();

        return relationQueryCalls;
      };

      // Only `posts` counts: once at each of the odd levels. Its three variants take the
      // invocation on the interface. Exponential planning made these 1,092 calls at depth 6 and
      // 4,473,924 at depth 12.
      expect(await callsAt(6)).toBe(3);
      expect(await callsAt(12)).toBe(6);
    });

    it('walks a named fragment spread beneath every variant once per level', async () => {
      const callsAt = async (depth: number) => {
        relationQueryCalls = 0;

        const result = await execute({
          schema,
          document: namedDocument('plannedCyclicUser', depth),
          contextValue: { user: { id: 1 } },
        });

        expect(result.errors).toBeUndefined();

        return relationQueryCalls;
      };

      // Each of the three `posts` nodes at each odd level, once. A walk per field node made these
      // 4,920 calls at depth 8.
      expect(await callsAt(8)).toBe(12);
      expect(await callsAt(20)).toBe(30);
    });

    it('shares the walk beneath a field whose select function does not read its path', async () => {
      const callsAt = async (depth: number) => {
        selectCalls = 0;

        const result = await execute({
          schema,
          document: namedDocument('plannedCyclicUser', depth, ['selectedPosts', 'selectedAuthor']),
          contextValue: { user: { id: 1 } },
        });

        expect(result.errors).toBeUndefined();

        return selectCalls;
      };

      // Each of the three nodes at each level. Reading the path for every select makes one call
      // per path, 1,092 at depth 6 and 9,840 at depth 8 (see below).
      expect(await callsAt(6)).toBe(18);
      expect(await callsAt(8)).toBe(24);
    });

    it('gives a select function that reads its path the path of each place it is planned', async () => {
      selectPaths.length = 0;

      const result = await execute({
        schema,
        document: gql`
          fragment Posts on CyclicUser {
            pathPosts {
              postId
            }
          }

          query {
            cyclicUser {
              ...Posts
              selectedPosts {
                selectedAuthor {
                  ...Posts
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(selectPaths).toEqual(
        expect.arrayContaining([
          ['Query.cyclicUser', 'CyclicUser.pathPosts'],
          [
            'Query.cyclicUser',
            'CyclicUser.selectedPosts',
            'CyclicPost.selectedAuthor',
            'CyclicUser.pathPosts',
          ],
        ]),
      );
    });

    describe('a select function or relation query that reads its path', () => {
      /** Every path the fields down to `depth` are planned at in `namedDocument`. */
      function pathsOf(depth: number, variants: number[], [posts, author]: string[]) {
        const paths: string[] = [];
        let above = ['Query.plannedCyclicUser'];

        for (let level = 1; level <= depth; level += 1) {
          above = above.flatMap((path) =>
            variants.map((n) =>
              level % 2 === 1
                ? `${path}/CyclicUser${n}.${posts}`
                : `${path}/CyclicPost${n}.${author}`,
            ),
          );
          paths.push(...above);
        }

        return paths.sort();
      }

      async function plan(document: ReturnType<typeof parse>) {
        selectPaths.length = 0;
        queryPaths.length = 0;

        const result = await execute({ schema, document, contextValue: { user: { id: 1 } } });

        expect(result.errors).toBeUndefined();

        return [...selectPaths, ...queryPaths].map((path) => path.join('/')).sort();
      }

      it.each([
        [6, [1, 2, 3]],
        [8, [1, 2, 3]],
        [8, [1]],
      ])('plans a select function once per path, depth %i, variants %j', async (depth, variants) => {
        const fields: [string, string] = ['pathPosts', 'pathAuthor'];
        const seen = await plan(namedDocument('plannedCyclicUser', depth, fields, variants));

        // When every invocation walked its own subtree, this made 2,015,538 calls at depth 8 for
        // 9,840 paths.
        expect(seen).toEqual(pathsOf(depth, variants, fields));
      });

      it('plans a relation query once per path', async () => {
        const fields: [string, string] = ['pathRelPosts', 'author'];
        const seen = await plan(namedDocument('plannedCyclicUser', 8, fields));

        // `posts` at the four odd levels: 3 + 27 + 243 + 2,187 paths, where 287,934 calls were made.
        expect(seen).toEqual(
          pathsOf(8, [1, 2, 3], fields).filter((path) => path.endsWith('.pathRelPosts')),
        );
      });

      it('plans a field in a fragment on the interface once per level', async () => {
        const seen = await plan(
          cyclicDocument('plannedCyclicUser', 8, ['pathPosts', 'pathAuthor']),
        );

        // The variants the expansion reaches each field on take the invocation on the interface,
        // so a path names the types the document does. Each variant made its own before: 87,380.
        expect(seen).toEqual(
          Array.from({ length: 8 }, (_, index) =>
            [
              'Query.plannedCyclicUser',
              ...Array.from({ length: index + 1 }, (__, level) =>
                level % 2 === 0 ? 'CyclicUser.pathPosts' : 'CyclicPost.pathAuthor',
              ),
            ].join('/'),
          ).sort(),
        );
      });

      /** Loads `document` with aliases, so fields that read their path answer like those that do not. */
      async function load(document: ReturnType<typeof parse>) {
        clearDrizzleLogs();

        const result = await execute({ schema, document, contextValue: { user: { id: 1 } } });

        expect(result.errors).toBeUndefined();

        return { data: result.data, sql: [...drizzleLogs] };
      }

      it('loads what a select function that does not read its path loads', async () => {
        const reading = await load(
          namedDocument('cyclicUser', 4, ['p: pathPosts', 'a: pathAuthor']),
        );

        expect(reading.sql).toHaveLength(1);
        expect(reading.data).toMatchObject({
          cyclicUser: { p: [{ a: { p: [{ a: { linked: 'linked' } }] } }] },
        });
        expect(reading).toEqual(
          await load(namedDocument('cyclicUser', 4, ['p: selectedPosts', 'a: selectedAuthor'])),
        );
      });

      it('loads beneath a fragment on the interface what it loads without the fragment', async () => {
        const fields: [string, string] = ['p: pathPosts', 'a: pathAuthor'];
        const reading = await load(cyclicDocument('cyclicUser', 4, fields, { leaf: 'userId' }));

        expect(reading.sql).toHaveLength(1);
        expect(reading.data).toMatchObject({
          cyclicUser: { p: [{ a: { p: [{ a: { userId: '1' } }] } }] },
        });
        expect(reading).toEqual(
          await load(cyclicDocument('cyclicUser', 4, fields, { linked: false, leaf: 'userId' })),
        );
      });
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

  describe('a query that reads its path beneath a fragment spread on two variants', () => {
    it('plans the relation for each path it is loaded at', async () => {
      branchPaths.length = 0;

      const result = await execute({
        schema,
        document: gql`
          fragment Author on Item {
            author {
              posts {
                id
              }
            }
          }

          query {
            items {
              ... on BugItem {
                ...Author
              }
              ... on FeatureItem {
                ...Author
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(branchPaths).toEqual(
        expect.arrayContaining([
          ['Query.items', 'BugItem.author', 'BranchUser.posts'],
          ['Query.items', 'FeatureItem.author', 'BranchUser.posts'],
        ]),
      );
      expect(result.data).toEqual({
        items: [
          { author: { posts: [{ id: '1' }, { id: '2' }] } },
          { author: { posts: [{ id: '15' }] } },
        ],
      });
    });
  });

  describe('a fragment whose variant displaces a field from the parent query', () => {
    it('loads the variant and reloads the field', async () => {
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
      expect(drizzleLogs).toHaveLength(2);
      expect(drizzleLogs[1]).toContain('params: [3,');
    });

    it('reloads the field for a list of rows in one statement', async () => {
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
      expect(drizzleLogs).toHaveLength(2);
    });

    it('loads the variant for fields with no select that read its row', async () => {
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

    it('loads the variant when no field is displaced', async () => {
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

        expect(result.errors?.[0]?.message).toBe('Unexpected error.');
        expect((result.errors?.[0]?.originalError?.cause as Error).message).toMatch(
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

      expect(result.errors?.[0]?.message).toBe('Unexpected error.');
      expect((result.errors?.[0]?.originalError?.cause as Error).message).toBe(
        'Type-level selections of NamedViewer and UppercaseViewer conflict on extra "casedFirstName". Define the extra with the same function on both types, or move it to a field-level select on one of the types.',
      );
    });
  });
});
