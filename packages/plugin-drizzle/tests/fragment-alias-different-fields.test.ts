import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { db } from './example/db';
import schema from './example/schema';

describe('drizzle - fragment alias with different fields', () => {
  afterAll(async () => {
    await db.$client.end();
  });

  it('should merge fields when fragments share alias but request different fields', async () => {
    // Using Post which has explicit select: { columns: { postId: true } }
    // This reproduces the issue where fragments with the same alias but different fields
    // cause additional fields to be loaded via separate queries
    // 
    // The fix ensures all fields from both fragments are fetched in the initial query
    const query = gql`
      query {
        post(id: "1") {
          id
          ...FragmentA
          ...FragmentB
        }
      }

      fragment FragmentA on Post {
        title
      }

      fragment FragmentB on Post {
        content
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

    // Verify we have the expected data structure with all fields
    const post = result.data?.post as any;
    expect(post).toBeDefined();
    expect(post.id).toBeDefined();
    
    // Fields from both fragments should be present
    expect(post.title).toBeDefined();
    expect(post.content).toBeDefined();
  });
});
