import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// A related connection reads what the document selects beneath it (totalCount, edges, ...) for
// every parent row, in its loaded check and again in its resolver. The selection is traversed
// once per request and the result shared by every row.
const selectedFieldNames = vi.hoisted(() => vi.fn());

vi.mock('@pothos/selection-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pothos/selection-mapper')>();

  selectedFieldNames.mockImplementation(actual.selectedFieldNames);

  return { ...actual, selectedFieldNames };
});

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
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
      id: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts', { totalCount: true }),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  select: {
    columns: {
      postId: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.drizzleField({
      type: [User],
      resolve: (query) => db.query.users.findMany(query({ limit: 3, orderBy: { id: 'asc' } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('connection selection facts', () => {
  afterEach(() => {
    clearDrizzleLogs();
    selectedFieldNames.mockClear();
  });

  it('reads the selection once and shares it with every parent row', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          users {
            postsConnection(first: 1) {
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
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();

    const { users } = result.data as {
      users: { postsConnection: { totalCount: number; edges: { node: { id: string } }[] } }[];
    };

    expect(users.length).toBeGreaterThan(1);

    for (const user of users) {
      expect(user.postsConnection.totalCount).toEqual(expect.any(Number));
      expect(user.postsConnection.edges.length).toBeLessThanOrEqual(1);
    }

    expect(drizzleLogs).toHaveLength(1);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", ((select count(*) from "posts" where "posts"."author_id" = "d0"."id")) as "_posts_count", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" order by "d0"."id" asc limit ? -- params: [2, 3]",
      ]
    `);

    // Read for every row, but traversed once: every read returns the same set.
    expect(selectedFieldNames.mock.calls.length).toBeGreaterThanOrEqual(users.length);
    expect(new Set(selectedFieldNames.mock.results.map((call) => call.value)).size).toBe(1);
    expect([...(selectedFieldNames.mock.results[0].value as Set<string>)]).toEqual([
      'totalCount',
      'edges',
    ]);
  });
});
