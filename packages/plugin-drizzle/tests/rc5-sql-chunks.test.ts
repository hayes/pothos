import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { schema } from './relation-shapes/schema';

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
