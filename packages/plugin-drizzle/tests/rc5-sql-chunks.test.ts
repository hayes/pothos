import { execute } from '@pothos/test-utils';
import type { SQL, SQLChunk } from 'drizzle-orm';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import { schema } from './relation-shapes/schema';

// Exercise RC5's helper return shapes even when the workspace installs an older supported
// Drizzle version. Query construction and execution still use the real SQLite driver.
vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  const chunks = (value: SQL | SQLChunk[] | undefined) =>
    Array.isArray(value) ? value : value?.queryChunks;

  return {
    ...original,
    relationToSQL: (...args: Parameters<typeof original.relationToSQL>) => {
      const result = original.relationToSQL(...args);

      return {
        ...result,
        filter: chunks(result.filter),
        joinCondition: chunks(result.joinCondition),
      };
    },
    relationsFilterToSQL: (...args: Parameters<typeof original.relationsFilterToSQL>) => {
      const result = original.relationsFilterToSQL(...args) as
        | SQL
        | { sql?: SQLChunk[] }
        | undefined;

      return original.is(result, original.SQL) ? { sql: chunks(result) } : (result ?? {});
    },
  };
});

async function query(document: string) {
  const result = await execute({ schema, document: gql(document), contextValue: {} });

  expect(result.errors).toBeUndefined();

  return result.data;
}

describe('Drizzle RC5 SQL chunks', () => {
  it('counts direct relations and applies connection filters', async () => {
    expect(
      await query(`{
        user(id: 1) {
          postsConnection(first: 1) { totalCount }
          filteredPostsConnection(first: 1) { totalCount }
          publishedPostsCount
        }
      }`),
    ).toMatchObject({
      user: {
        postsConnection: { totalCount: 15 },
        filteredPostsConnection: { totalCount: 9 },
        publishedPostsCount: 9,
      },
    });
  });

  it('preserves junction joins and filtered connection counts', async () => {
    expect(
      await query(`{
        post(id: 1) {
          commentersConnection(first: 1) { totalCount }
          filteredCommentersConnection(first: 1) { totalCount }
          commentersCount
        }
      }`),
    ).toMatchObject({
      post: {
        commentersConnection: { totalCount: 5 },
        filteredCommentersConnection: { totalCount: 3 },
        commentersCount: 4,
      },
    });
  });

  it('accepts a filter result without SQL chunks', async () => {
    expect(
      await query('{ user(id: 1) { emptyFilterPostsConnection(first: 1) { totalCount } } }'),
    ).toMatchObject({ user: { emptyFilterPostsConnection: { totalCount: 15 } } });
  });

  it('builds the SQLite identity lookup for relatedField', async () => {
    expect(await query('{ post(id: 1) { commentersFieldCount } }')).toMatchObject({
      post: { commentersFieldCount: 4 },
    });
  });

  it('preserves inherited restrictions on reversed relations', async () => {
    expect(
      await query(`{
        unpublished: post(id: 1) { publishedAuthorCount }
        published: post(id: 2) { publishedAuthorCount }
      }`),
    ).toMatchObject({
      unpublished: { publishedAuthorCount: 0 },
      published: { publishedAuthorCount: 1 },
    });
  });
});
