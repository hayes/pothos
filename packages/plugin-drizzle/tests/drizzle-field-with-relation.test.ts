import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, db, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('drizzle field with manual relations', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('should handle manual findMany with nested relations', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    
    // This is what the user is doing - manually fetching with relations
    const comments = await db.query.comments.findMany({
      where: { authorId: 1 },
      orderBy: { createdAt: 'desc' },
      limit: 2,
      with: { author: true },
    });
    
    // The issue happens when the returned data is used in a drizzleField
    // and the plugin tries to load selections for the nested relations
    console.log('Comments with author:', JSON.stringify(comments[0], null, 2));
    
    // Verify the author relation was fetched correctly
    expect(comments[0].author).toBeDefined();
    expect(comments[0].author.id).toBeDefined();
  });
});
