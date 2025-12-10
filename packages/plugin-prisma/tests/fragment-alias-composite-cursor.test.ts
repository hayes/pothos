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
    // Using SelectPost which has explicit select: { id: true }
    // This will reproduce the issue where fragments with the same alias but different fields
    // cause additional fields to be loaded via separate findUnique queries
    const query = gql`
      query {
        me {
          id
          ...FragmentA
          ...FragmentB
        }
      }

      fragment FragmentA on User {
        postsAlias: postNodes(first: 5) {
          id
          title
        }
      }

      fragment FragmentB on User {
        postsAlias: postNodes(first: 5) {
          id
          content
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

    // The key issue: Before the fix, we would have extra findUnique queries for missing fields
    // After the fix, all fields should be fetched in the initial query
    const findUniqueCount = queries.filter(
      (q: any) => q.action === 'findUniqueOrThrow' || q.action === 'findUnique',
    ).length;

    console.log(`findUnique/findUniqueOrThrow count: ${findUniqueCount}`);

    // Verify we have the expected data structure
    const user = result.data?.me as any;
    expect(user).toBeDefined();
    expect(user.postsAlias).toBeDefined();
    expect(Array.isArray(user.postsAlias)).toBe(true);

    // Verify all fields from both fragments are present
    if (user.postsAlias.length > 0) {
      const firstPost = user.postsAlias[0];
      // Fields from FragmentA
      expect(firstPost.id).toBeDefined();
      expect(firstPost.title).toBeDefined();
      // Fields from FragmentB
      expect(firstPost.content).toBeDefined();
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
        postsAliasA: postNodes(first: 5) {
          id
          title
        }
      }

      fragment FragmentB on User {
        postsAliasB: postNodes(first: 5) {
          id
          content
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
