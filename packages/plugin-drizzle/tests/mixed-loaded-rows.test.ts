import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin, { type PathInfo } from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// A list can return rows of mixed loaded state: some carry what the planned query selected, and
// some do not, so those fall back to the model loader. The fallback plans the same fields again
// and records mappings of its own, and a mapping carries the position a `relatedConnection`
// pages with. A row must page with the position its own data was fetched at, whichever row of
// the list ran the fallback and whichever tick each row completes in.
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

const seenPaths: string[] = [];

builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts', {
      // Two pages that cannot be mistaken for one another: the planned path selects the first
      // two posts, and every other path selects a much larger page in the opposite order.
      query: ((_args: {}, _ctx: {}, pathInfo: PathInfo | undefined) => {
        const path = pathInfo?.path ?? [];

        seenPaths.push(path.join(' > '));

        const planned = path[0]?.startsWith('Query.') ?? false;

        return { orderBy: { postId: planned ? 'asc' : 'desc' }, limit: planned ? 2 : 20 };
      }) as never,
    }),
  }),
});

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    author: t.relation('author'),
  }),
});

/** A row that completes a tick after its siblings, so it reads the mapping cache last. */
const late = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 5));

function posts(query: (args: {}) => {}) {
  return db.query.posts.findMany(
    query({ orderBy: { postId: 'asc' }, limit: 3 }),
  ) as unknown as Promise<Record<string, never>[]>;
}

builder.queryType({
  fields: (t) => ({
    // Every row loaded by the planned query, one of them late: the answer every planned row
    // must give, whatever its siblings did.
    planned: t.drizzleField({
      type: [Post],
      resolve: async (query) => {
        const rows = await posts(query);

        return [rows[0], rows[1], late(rows[2])] as never;
      },
    }),
    // No row loaded by the planned query: the answer every fallback row must give.
    fallback: t.drizzleField({
      type: [Post],
      resolve: async (query) => {
        const rows = await posts(query);

        return rows.map((row) => ({ ...row, author: undefined })) as never;
      },
    }),
    // Row 1's author arrives without its posts, so that row's connection falls back while its
    // siblings' do not.
    nestedFallback: t.drizzleField({
      type: [Post],
      resolve: async (query) => {
        const rows = await posts(query);

        return [
          rows[0],
          { ...rows[1], author: { ...(rows[1].author as object), posts: undefined } },
          late(rows[2]),
        ] as never;
      },
    }),
    // Row 0's author is missing entirely, so the relation itself falls back and replans
    // everything beneath it, including the connection its siblings were planned with.
    relationFallback: t.drizzleField({
      type: [Post],
      resolve: async (query) => {
        const rows = await posts(query);

        return [{ ...rows[0], author: undefined }, rows[1], late(rows[2])] as never;
      },
    }),
  }),
});

const schema = builder.toSchema();

interface Page {
  ids: string[];
  hasNextPage: boolean;
}

async function run(field: string) {
  seenPaths.length = 0;
  clearDrizzleLogs();

  const result = await execute({
    schema,
    document: gql`
      query {
        ${field} {
          id
          author {
            id
            postsConnection(first: 4) {
              edges { node { id } }
              pageInfo { hasNextPage }
            }
          }
        }
      }
    `,
    contextValue: { user: { id: 1 } },
  });

  expect(result.errors).toBeUndefined();

  const rows = (result.data as Record<string, never>)[field] as never as {
    author: {
      postsConnection: { edges: { node: { id: string } }[]; pageInfo: { hasNextPage: boolean } };
    };
  }[];

  return {
    paths: [...seenPaths],
    queries: drizzleLogs.length,
    pages: rows.map(
      (row): Page => ({
        ids: row.author.postsConnection.edges.map((edge) => edge.node.id),
        hasNextPage: row.author.postsConnection.pageInfo.hasNextPage,
      }),
    ),
  };
}

describe('rows of one list with mixed loaded state', () => {
  let plannedPage: Page;
  let fallbackPage: Page;

  beforeAll(async () => {
    const planned = await run('planned');
    const fallback = await run('fallback');

    [plannedPage] = planned.pages;
    [fallbackPage] = fallback.pages;

    // The two states have to be told apart for any of this to mean anything.
    expect(plannedPage).not.toEqual(fallbackPage);
    expect(planned.pages).toEqual([plannedPage, plannedPage, plannedPage]);
    expect(fallback.pages).toEqual([fallbackPage, fallbackPage, fallbackPage]);
    // Rows that agree are planned and loaded together, however many of them there are: one
    // query for the planned list, and one more for the three rows that fell back as a batch.
    expect(planned.queries).toBe(1);
    expect(fallback.queries).toBe(2);
  });

  it('pages a fallback row and its planned siblings each at their own position', async () => {
    const { pages, queries } = await run('nestedFallback');

    // Row 1 fell back; rows 0 and 2 were loaded by the planned query, and row 2 a tick later.
    expect(pages).toEqual([plannedPage, fallbackPage, plannedPage]);
    expect(pages[0]).toEqual(pages[2]);
    // The planned query, plus the one the fallback row needed. Nothing else re-queried.
    expect(queries).toBe(2);
  });

  it('pages a row whose relation fell back without repaging its planned siblings', async () => {
    const { pages, paths, queries } = await run('relationFallback');

    // Row 0's relation fell back, replanning the connection beneath it; rows 1 and 2 were
    // loaded by the planned query, and row 2 a tick later — after the fallback had recorded
    // its own mapping for the same response path.
    expect(pages).toEqual([fallbackPage, plannedPage, plannedPage]);
    expect(pages[1]).toEqual(pages[2]);
    // One position off the planned path: the fallback row's. A planned row that read the
    // fallback's mapping would show up as a second.
    expect(paths.filter((path) => !path.startsWith('Query.'))).toEqual([
      'Post.author > User.postsConnection',
    ]);
    expect(queries).toBe(2);
  });
});
