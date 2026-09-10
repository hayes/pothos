import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

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

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});

let recordedSegments: { field: string; isList: boolean }[] = [];

builder.drizzleObject('userProfile', {
  name: 'Profile',
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio', { nullable: true }),
  }),
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    profile: t.relation('profile', { nullable: true }),
    posts: t.relation('posts'),
    postCount: t.relatedCount('posts'),
    postsConnection: t.relatedConnection('posts', {
      totalCount: true,
      query: () => ({ orderBy: { postId: 'desc' } }),
    }),
    postsWithPath: t.relation('posts', {
      query: (_args, _ctx, pathInfo) => {
        recordedSegments = pathInfo.segments;
        return {};
      },
    }),
    postsWithResolve: t.relatedConnection('posts', {
      // A custom resolver was accepted and silently discarded; it is now rejected.
      // @ts-expect-error resolve is not an option for relatedConnection
      resolve: () => [],
    }),
  }),
});

// The third argument is optional, so a helper with no custom selection is a two-argument call.
const commentHelpers = drizzleConnectionHelpers(builder, 'comments');

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    // Returns a row fetched without the planned selection, so no relation is on it. Every
    // relation field must then load itself rather than answer from the missing data.
    rawUser: t.drizzleField({
      type: User,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }),
    }),
    // A row that carries the relation rows but not the count the connection also needs.
    userWithPosts: t.drizzleField({
      type: User,
      resolve: () => db.query.users.findFirst({ where: { id: 1 }, with: { posts: true } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('relation loading', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('builds connection helpers without options', () => {
    expect(typeof commentHelpers.getQuery).toBe('function');
  });

  it('loads relations that are missing from a row the resolver fetched itself', async () => {
    const planned = await execute({
      schema,
      document: gql`
        query {
          user {
            profile {
              id
            }
            posts {
              id
            }
            postCount
            postsConnection(first: 2) {
              totalCount
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(planned.errors).toBeUndefined();
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", ((select count(*) from "posts" where "d0"."id" = "posts"."author_id")) as "_posts_count", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id") as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
        "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", ((select count(*) from "posts" where "d0"."id" = "posts"."author_id")) as "_posts_count", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [3, 1]",
      ]
    `);
    clearDrizzleLogs();

    const raw = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            profile {
              id
            }
            posts {
              id
            }
            postCount
            postsConnection(first: 2) {
              totalCount
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(raw.errors).toBeUndefined();
    expect(raw.data).toEqual({ rawUser: (planned.data as { user: unknown }).user });
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", ((select count(*) from "posts" where "d0"."id" = "posts"."author_id")) as "_posts_count", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id") as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [1, 1]",
        "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", ((select count(*) from "posts" where "d0"."id" = "posts"."author_id")) as "_posts_count", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [3, 1]",
      ]
    `);
  });

  it('answers a totalCount-only connection from the loaded count', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            postsConnection {
              totalCount
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ rawUser: { postsConnection: { totalCount: 15 } } });
    expect(drizzleLogs).toHaveLength(2);
    expect(drizzleLogs[1]).toContain('count(*)');
  });

  it('answers a totalCount-only connection selected through a fragment', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            postsConnection {
              ... on UserPostsConnection {
                totalCount
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ rawUser: { postsConnection: { totalCount: 15 } } });
  });

  it('treats a connection whose row fields are skipped as totalCount-only', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            postsConnection {
              totalCount
              edges @skip(if: true) {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ rawUser: { postsConnection: { totalCount: 15 } } });
  });

  it('loads the count when the row has the relation but not the count', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          userWithPosts {
            postsConnection(first: 2) {
              totalCount
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      userWithPosts: {
        postsConnection: {
          totalCount: 15,
          edges: [{ node: { id: '15' } }, { node: { id: '14' } }],
        },
      },
    });
    // the raw row, then the loader reloading the connection with its count
    expect(drizzleLogs).toHaveLength(2);
    expect(drizzleLogs[1]).toContain('count(*)');
  });

  it('plans every occurrence of the field when loading it through the fallback', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            posts {
              id
            }
            ... on User {
              posts {
                author {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    const posts = (result.data as { rawUser: { posts: { id: string; author: { id: string } }[] } })
      .rawUser.posts;
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((post) => post.author.id === '1')).toBe(true);
  });

  it('marks non-null list fields as lists in pathInfo segments', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsWithPath {
              id
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(recordedSegments.at(-1)).toMatchObject({ field: 'postsWithPath', isList: true });
  });
});
