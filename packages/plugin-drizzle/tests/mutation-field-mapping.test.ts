import { eq } from 'drizzle-orm';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, db, drizzleLogs } from './example/db';
import { categories } from './example/db/schema';
import { schema } from './example/schema';

describe('drizzle mutation field mappings', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('should not perform unnecessary ModelLoader queries when mutation returns sufficient data', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    
    const result = await execute({
      schema,
      document: gql`
        mutation {
          likePost(postId: "1") {
            id
            title
          }
        }
      `,
      contextValue: context,
    });
    
    // Should only see one query: the findFirst query from the mutation resolver
    // Should NOT see a second query from ModelLoader trying to load the selection
    expect(drizzleLogs.length).toBe(2); // insert + findFirst
    expect(drizzleLogs[0]).toContain('insert');
    expect(drizzleLogs[1]).toContain('select');
    // Should NOT contain a third query that looks like "where "d0"."id" in"
    expect(drizzleLogs.filter((log) => log.includes('where "d0"."id" in')).length).toBe(0);
    
    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchObject({
      likePost: {
        id: '1',
        title: expect.any(String),
      },
    });
  });

  it('should handle delete mutation that returns deleted object', async () => {
    const context = await createContext({ userId: '1' });
    
    // Create a category first
    await db.insert(categories).values({ name: 'test-category' });
    
    clearDrizzleLogs();
    
    const result = await execute({
      schema,
      document: gql`
        mutation {
          deleteCategory(name: "test-category") {
            id
            name
          }
        }
      `,
      contextValue: context,
    });
    
    // Should only see: delete query with returning
    // Should NOT see a ModelLoader query trying to load deleted records
    expect(drizzleLogs.length).toBe(1);
    expect(drizzleLogs[0]).toContain('delete');
    expect(drizzleLogs[0]).toContain('returning');
    // Should NOT contain a query that looks like "where "d0"."id" in"
    expect(drizzleLogs.filter((log) => log.includes('where "d0"."id" in')).length).toBe(0);
    
    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteCategory).toHaveLength(1);
    expect(result.data?.deleteCategory[0]).toMatchObject({
      id: expect.any(String),
      name: 'test-category',
    });
  });

  it('should handle create mutation that returns created object', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    
    const categoryName = `test-${Date.now()}`;
    
    const result = await execute({
      schema,
      document: gql`
        mutation CreateCategory($name: String!) {
          createCategory(name: $name) {
            id
            name
          }
        }
      `,
      variableValues: { name: categoryName },
      contextValue: context,
    });
    
    // Should only see: insert query with returning
    // Should NOT see a ModelLoader query
    expect(drizzleLogs.length).toBe(1);
    expect(drizzleLogs[0]).toContain('insert');
    expect(drizzleLogs[0]).toContain('returning');
    expect(drizzleLogs.filter((log) => log.includes('where "d0"."id" in')).length).toBe(0);
    
    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchObject({
      createCategory: {
        id: expect.any(String),
        name: categoryName,
      },
    });
    
    // Cleanup
    await db.delete(categories).where(eq(categories.name, categoryName));
  });
});
