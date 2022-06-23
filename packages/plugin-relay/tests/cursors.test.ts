import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './examples/relay/schema';

describe('cursor based connection', () => {
  it('queries', async () => {
    const query = gql`
      query {
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
});
