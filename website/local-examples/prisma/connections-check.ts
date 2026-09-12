import assert from 'node:assert/strict';
import { type GraphQLSchema, graphql } from 'graphql';

export async function checkMediaConnections(schema: GraphQLSchema) {
  const run = async (source: string, variableValues?: Record<string, unknown>) => {
    const result = await graphql({ schema, source, contextValue: { userId: 1 }, variableValues });
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    return JSON.parse(JSON.stringify(result.data));
  };
  const first = await run(`
    {
      author(id: 1) {
        posts(oldestFirst: true) {
          title
          mediaConnection(first: 1) {
            totalCount
            edges {
              caption
              node {
                url
                uploadedBy {
                  name
                }
              }
            }
            pageInfo {
              startCursor
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  `);
  const [seedLibrary, composting] = first.author.posts;
  assert.equal(seedLibrary.mediaConnection.totalCount, 2);
  assert.equal(composting.mediaConnection.totalCount, 1);
  assert.equal(seedLibrary.mediaConnection.pageInfo.hasNextPage, true);
  assert.equal(composting.mediaConnection.pageInfo.hasNextPage, false);
  assert.deepEqual(seedLibrary.mediaConnection.edges, [
    {
      caption: 'The neighborhood seed library',
      node: {
        url: 'https://images.example.com/seed-library.jpg',
        uploadedBy: { name: 'Leo Silva' },
      },
    },
  ]);
  assert.deepEqual(composting.mediaConnection.edges, [
    {
      caption: 'Compost helps the seed library grow',
      node: {
        url: 'https://images.example.com/seed-library.jpg',
        uploadedBy: { name: 'Leo Silva' },
      },
    },
  ]);

  const captionsOnly = await run(`
    {
      author(id: 1) {
        posts(oldestFirst: true) {
          mediaConnection(first: 1) {
            edges {
              caption
            }
          }
        }
      }
    }
  `);
  assert.deepEqual(captionsOnly, {
    author: {
      posts: [
        { mediaConnection: { edges: [{ caption: 'The neighborhood seed library' }] } },
        { mediaConnection: { edges: [{ caption: 'Compost helps the seed library grow' }] } },
      ],
    },
  });

  const nodeId = Buffer.from('Post:1').toString('base64');
  const next = await run(
    `
    query ($id: ID!, $after: String!) {
      node(id: $id) {
        ... on Post {
          mediaConnection(first: 1, after: $after) {
            totalCount
            edges {
              caption
              node {
                url
                uploadedBy {
                  name
                }
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  `,
    { id: nodeId, after: seedLibrary.mediaConnection.pageInfo.endCursor },
  );
  assert.equal(next.node.mediaConnection.totalCount, 2);
  assert.equal(next.node.mediaConnection.pageInfo.hasNextPage, false);
  assert.deepEqual(next.node.mediaConnection.edges, [
    {
      caption: 'Label packets before sharing',
      node: {
        url: 'https://images.example.com/seed-packets.jpg',
        uploadedBy: { name: 'Maya Chen' },
      },
    },
  ]);
  const previous = await run(
    `
    query ($id: ID!, $before: String!) {
      node(id: $id) {
        ... on Post {
          mediaConnection(last: 1, before: $before) {
            edges {
              caption
              node {
                url
              }
            }
          }
        }
      }
    }
  `,
    { id: nodeId, before: next.node.mediaConnection.pageInfo.endCursor },
  );
  assert.deepEqual(previous.node.mediaConnection.edges, [
    {
      caption: 'The neighborhood seed library',
      node: { url: 'https://images.example.com/seed-library.jpg' },
    },
  ]);
  const empty = await run(`
    {
      author(id: 2) {
        posts {
          mediaConnection(first: 1) {
            totalCount
            edges {
              caption
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `);
  assert.deepEqual(empty.author.posts[0].mediaConnection, {
    totalCount: 0,
    edges: [],
    pageInfo: { hasNextPage: false, endCursor: null },
  });
  assert.deepEqual(
    await run(`
    {
      author(id: 1) {
        posts(oldestFirst: true) {
          mediaConnection {
            totalCount
          }
        }
      }
    }
  `),
    {
      author: {
        posts: [{ mediaConnection: { totalCount: 2 } }, { mediaConnection: { totalCount: 1 } }],
      },
    },
  );
  assert.deepEqual(
    await run(`
    {
      posts {
        totalCount
      }
    }
  `),
    { posts: { totalCount: 3 } },
  );
}
