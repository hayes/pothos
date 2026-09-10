import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './examples/relay/schema';

describe('cursor based connection', () => {
  it('queries', async () => {
    const query = gql`
      query {
        noArgs: cursorConnection {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        after: cursorConnection(after: 98) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        afterFirst: cursorConnection(after: 95, first: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        afterLast: cursorConnection(after: 95, last: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        afterFull: cursorConnection(after: 40) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        afterFullFirst: cursorConnection(after: 40, first: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        afterLastFull: cursorConnection(after: 40, last: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        before: cursorConnection(before: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        beforeFirst: cursorConnection(before: 5, first: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        beforeLast: cursorConnection(before: 5, last: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        beforeFull: cursorConnection(before: 40) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        beforeFullFirst: cursorConnection(before: 40, first: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
        beforeLastFull: cursorConnection(before: 40, last: 2) {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchSnapshot();
  });

  describe('page size of 0', () => {
    async function pageOf(args: string) {
      const query = gql`
        query {
          connection: cursorConnection(${args}) {
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
            edges {
              node {
                id
              }
            }
          }
        }
      `;

      const result = await execute({ schema, document: query, contextValue: {} });

      expect(result.errors).toBeUndefined();

      return (result.data as { connection: unknown }).connection;
    }

    it('first: 0 returns no edges, and reports a next page', async () => {
      expect(await pageOf('first: 0')).toEqual({
        edges: [],
        pageInfo: { hasNextPage: true, hasPreviousPage: false },
      });
    });

    it('first: 0 with an after cursor returns no edges, and reports pages on both sides', async () => {
      expect(await pageOf('first: 0, after: 10')).toEqual({
        edges: [],
        pageInfo: { hasNextPage: true, hasPreviousPage: true },
      });
    });

    it('first: 0 with a before cursor pages forward, not backward', async () => {
      expect(await pageOf('first: 0, before: 10')).toEqual({
        edges: [],
        pageInfo: { hasNextPage: true, hasPreviousPage: false },
      });
    });

    it('first: 0 with a last argument pages forward, not backward', async () => {
      expect(await pageOf('first: 0, last: 2')).toEqual({
        edges: [],
        pageInfo: { hasNextPage: true, hasPreviousPage: false },
      });
    });

    it('last: 0 returns no edges, and reports a previous page', async () => {
      expect(await pageOf('last: 0')).toEqual({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: true },
      });
    });

    it('last: 0 with a before cursor returns no edges, and reports pages on both sides', async () => {
      expect(await pageOf('last: 0, before: 10')).toEqual({
        edges: [],
        pageInfo: { hasNextPage: true, hasPreviousPage: true },
      });
    });

    it('last: 0 with an after cursor pages backward, not forward', async () => {
      expect(await pageOf('last: 0, after: 10')).toEqual({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: true },
      });
    });
  });
});
