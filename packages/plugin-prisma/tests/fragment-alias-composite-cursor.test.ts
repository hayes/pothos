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
    // This reproduces the issue where fragments with the same alias but different fields
    // cause additional fields to be loaded via separate findUniqueOrThrow queries
    // 
    // Before fix: 1 findUnique + 3 findUniqueOrThrow = 4 queries
    // After fix: 1 findUnique = 1 query
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

    // The key assertion: all fields should be fetched in the initial query
    // No separate findUniqueOrThrow queries should be needed
    const findUniqueOrThrowCount = queries.filter(
      (q: any) => q.action === 'findUniqueOrThrow',
    ).length;

    expect(findUniqueOrThrowCount).toBe(0);

    // Verify we have the expected data structure with all fields
    const user = result.data?.me as any;
    expect(user).toBeDefined();
    expect(user.postsAlias).toBeDefined();
    expect(Array.isArray(user.postsAlias)).toBe(true);

    if (user.postsAlias.length > 0) {
      const firstPost = user.postsAlias[0];
      // Fields from both fragments should be present
      expect(firstPost.id).toBeDefined();
      expect(firstPost.title).toBeDefined();
      expect(firstPost.content).toBeDefined();
    }
  });
});
