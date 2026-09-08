import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// Fields resolved through the model loader fallback: the loaded row replaces the parent the
// resolver sees, so the loader query has to satisfy the parent type's own selection too.
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
      firstName: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    summary: t.string({
      select: {
        with: {
          posts: true,
        },
      },
      resolve: (user) => `${user.firstName}:${user.posts.length}`,
    }),
    // Selects nothing from the parent row, so it is never answered from the planned query.
    shout: t.string({
      nullable: true,
      select: () => null as unknown as { columns: { firstName: true } },
      resolve: (user) => user.firstName?.toUpperCase(),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    // Returns a row fetched without the planned selection, so every field with a `select`
    // has to load its own data through the model loader.
    rawUser: t.drizzleField({
      type: User,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('model loader fallback', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it("selects the parent type's type-level columns alongside the field's select", async () => {
    const planned = await execute({
      schema,
      document: gql`
        query {
          user {
            summary
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(planned.errors).toBeUndefined();
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id") as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);
    clearDrizzleLogs();

    const raw = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            summary
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
        "Query: select "d0"."first_name" as "firstName", "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId", 'slug', "slug", 'title', "title", 'content', "content", 'published', "published", 'authorId', "authorId", 'categoryId', "categoryId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "postId", "d1"."slug" as "slug", "d1"."title" as "title", "d1"."content" as "content", "d1"."published" as "published", "d1"."author_id" as "authorId", "d1"."category_id" as "categoryId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "posts" as "d1" where "d0"."id" = "d1"."author_id") as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [1]",
      ]
    `);
  });

  it('loads a field whose select returns nothing through the fallback', async () => {
    const user = await db.query.users.findFirst({ where: { id: 1 } });
    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            shout
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { shout: user?.firstName?.toUpperCase() ?? null } });
    // The planned query and the fallback both carry only the type-level columns.
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."id" as "id" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
        "Query: select "d0"."first_name" as "firstName", "d0"."id" as "id" from "users" as "d0" where "d0"."id" in (?) -- params: [1]",
      ]
    `);
  });
});
