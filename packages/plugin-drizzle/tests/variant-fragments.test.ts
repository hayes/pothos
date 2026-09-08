import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

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

builder.queryType({
  fields: (t) => ({
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
});
