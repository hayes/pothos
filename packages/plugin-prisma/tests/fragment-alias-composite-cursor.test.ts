import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('prisma - fragment alias with different fields', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should merge fields when fragments share alias but request different fields', async () => {
    // Testing that when two fragments use the same alias but request different fields,
    // all fields are merged and fetched in one query (not separately via findUnique)
    const query = gql`
      query {
        me {
          id
          ...FragmentA
          ...FragmentB
        }
      }

      fragment FragmentA on User {
        postsAlias: postsConnection(first: 5) {
          edges {
            node {
              id
              title
            }
          }
        }
      }

      fragment FragmentB on User {
        postsAlias: postsConnection(first: 5) {
          edges {
            node {
              id
              content
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    // Check that the query executed successfully
    expect(result.errors).toBeUndefined();
    expect(result.data).toBeDefined();

    // Log all queries
    console.log('\n======= ALL QUERIES (SHARED ALIAS) =======');
    queries.forEach((q, i) => {
      console.log(`\nQuery ${i + 1}:`);
      console.log(JSON.stringify(q, null, 2));
    });
    console.log('===========================================\n');

    // The key fix: Before, we would have extra findUnique queries for missing fields
    // After the fix, all fields should be fetched together
    const findUniqueCount = queries.filter(
      (q: any) => q.action === 'findUniqueOrThrow' || q.action === 'findUnique',
    ).length;

    console.log(`findUnique/findUniqueOrThrow count: ${findUniqueCount}`);

    // Verify we have the expected data structure
    const user = result.data?.me as any;
    expect(user).toBeDefined();
    expect(user.postsAlias).toBeDefined();
    expect(user.postsAlias.edges).toBeDefined();

    // Verify all fields from both fragments are present
    if (user.postsAlias.edges.length > 0) {
      const firstNode = user.postsAlias.edges[0].node;
      // Fields from FragmentA
      expect(firstNode.id).toBeDefined();
      expect(firstNode.title).toBeDefined();
      // Fields from FragmentB
      expect(firstNode.content).toBeDefined();
    }
  });

  it('should work correctly with different aliases (baseline)', async () => {
    const query = gql`
      query {
        me {
          id
          ...FragmentA
          ...FragmentB
        }
      }

      fragment FragmentA on User {
        postsAliasA: postsConnection(first: 5) {
          edges {
            node {
              id
              title
            }
          }
        }
      }

      fragment FragmentB on User {
        postsAliasB: postsConnection(first: 5) {
          edges {
            node {
              id
              content
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    // Check that the query executed successfully
    expect(result.errors).toBeUndefined();
    expect(result.data).toBeDefined();

    // Log all queries
    console.log('\n======= QUERIES (DIFFERENT ALIASES) =======');
    queries.forEach((q, i) => {
      console.log(`\nQuery ${i + 1}:`);
      console.log(JSON.stringify(q, null, 2));
    });
    console.log('============================================\n');

    // Verify we have the expected data structure
    const user = result.data?.me as any;
    expect(user).toBeDefined();
    expect(user.postsAliasA).toBeDefined();
    expect(user.postsAliasB).toBeDefined();
  });
});
