import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { getSchemaConfig } from '../src/utils/config';
import { queryFromInfo } from '../src/utils/map-query';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// Types carrying `pothosIndirectInclude` with `paths`: the selection under the matched paths is
// planned for the target table, and the wrapper's own selection only when the wrapper itself is
// backed by that table.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { user: { id: number } };
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

const User = builder.drizzleObject('users', {
  name: 'User',
  select: {
    columns: {
      username: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    posts: t.relation('posts'),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

const nodePaths = { getType: () => 'User', paths: [[{ name: 'node' }]] };

// A variant of the target table that also points at a nested `node` field.
const UserSummary = builder.drizzleObject('users', {
  variant: 'UserSummary',
  select: {
    columns: {
      username: true,
      firstName: true,
    },
  },
  extensions: { pothosIndirectInclude: nodePaths },
  fields: (t) => ({
    node: t.field({ type: User, resolve: (user) => user }),
    reverseFirstName: t.string({
      nullable: true,
      resolve: (user) => user.firstName?.split('').reverse().join(''),
    }),
  }),
});

// A wrapper without a table of its own.
const UserWrapper = builder.objectRef<{ user: { username: string } }>('UserWrapper').implement({
  extensions: { pothosIndirectInclude: nodePaths },
  fields: (t) => ({
    node: t.field({ type: User, resolve: (wrapper) => wrapper.user }),
    label: t.string({ resolve: () => 'wrapper' }),
  }),
});

// A wrapper backed by a different table than the one its `node` points at.
const ProfileWithUser = builder.drizzleObject('userProfile', {
  variant: 'ProfileWithUser',
  extensions: { pothosIndirectInclude: nodePaths },
  fields: (t) => ({
    bio: t.exposeString('bio', { nullable: true }),
    node: t.drizzleField({
      type: User,
      resolve: (query, profile) =>
        db.query.users.findFirst(query({ where: { id: profile.userId } })),
    }),
  }),
});

const plannedQueries: unknown[] = [];

builder.queryType({
  fields: (t) => ({
    userSummary: t.drizzleField({
      type: UserSummary,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    wrapper: t.field({
      type: UserWrapper,
      resolve: async (_root, _args, context, info) => {
        const user = await db.query.users.findFirst({
          ...queryFromInfo({ config: getSchemaConfig(builder), context, info }),
          where: { id: 1 },
        });

        if (!user) {
          throw new Error('User 1 not found');
        }

        return { user };
      },
    }),
    profileWrapper: t.drizzleField({
      type: ProfileWithUser,
      resolve: (query) => {
        plannedQueries.push(query({}));

        return db.query.userProfile.findFirst({ where: { userId: 1 } });
      },
    }),
  }),
});

const schema = builder.toSchema();

describe('wrappers with indirect include paths', () => {
  let user: { username: string; firstName: string | null };

  beforeAll(async () => {
    const row = await db.query.users.findFirst({ where: { id: 1 } });

    if (!row) {
      throw new Error('User 1 not found');
    }

    user = row;
    clearDrizzleLogs();
  });

  afterEach(() => {
    clearDrizzleLogs();
    plannedQueries.length = 0;
  });

  it("plans a same-table variant's own select alongside the node selection", async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          userSummary {
            reverseFirstName
            node {
              username
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
        reverseFirstName: user.firstName?.split('').reverse().join('') ?? null,
        node: {
          username: user.username,
          posts: expect.arrayContaining([{ id: expect.any(String) }]),
        },
      },
    });
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id") as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);
  });

  it('plans nothing of its own for a wrapper without a table', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          wrapper {
            label
            node {
              username
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
      wrapper: {
        label: 'wrapper',
        node: {
          username: user.username,
          posts: expect.arrayContaining([{ id: expect.any(String) }]),
        },
      },
    });
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."username" as "username", "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id") as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);
  });

  it('plans nothing of its own for a wrapper backed by another table', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          profileWrapper {
            bio
            node {
              username
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
        node: {
          username: user.username,
          posts: expect.arrayContaining([{ id: expect.any(String) }]),
        },
      },
    });
    // The query planned for the wrapper is a users query: nothing of the profile table leaks in.
    expect(plannedQueries).toMatchInlineSnapshot(`
      [
        {
          "columns": {
            "id": true,
            "username": true,
          },
          "extras": {},
          "with": {
            "posts": {
              "columns": undefined,
              "extras": {},
              "with": {},
            },
          },
        },
      ]
    `);
  });
});
