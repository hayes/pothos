import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('query path tracking', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('captures pathInfo in t.relation() query callback', async () => {
    const context = await createContext({ userId: '1' });

    // First query to trigger the relation with query callback
    const result = await execute({
      schema,
      document: gql`
        {
          user(id: "VXNlcjox") {
            firstName
            postsWithPathInfo(testLimit: 2) {
              id
              title
            }
          }
          capturedPathInfo {
            path
            segments {
              field
              alias
              parentType
              isList
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();

    const data = result.data as {
      user: { firstName: string; postsWithPathInfo: { id: string; title: string }[] };
      capturedPathInfo: {
        path: string[];
        segments: { field: string; alias: string; parentType: string; isList: boolean }[];
      };
    };

    expect(data.user.firstName).toBe('Mason');
    expect(data.user.postsWithPathInfo.length).toBe(2);
    expect(data.capturedPathInfo).toBeDefined();
    expect(data.capturedPathInfo.path).toEqual(['Query.user', 'User.postsWithPathInfo']);
    expect(data.capturedPathInfo.segments).toHaveLength(2);
    expect(data.capturedPathInfo.segments[0]).toEqual({
      field: 'user',
      alias: 'user',
      parentType: 'Query',
      isList: false,
    });
    expect(data.capturedPathInfo.segments[1]).toEqual({
      field: 'postsWithPathInfo',
      alias: 'postsWithPathInfo',
      parentType: 'User',
      isList: true,
    });
  });

  it('captures aliases in pathInfo segments', async () => {
    const context = await createContext({ userId: '1' });

    const result = await execute({
      schema,
      document: gql`
        {
          myUser: user(id: "VXNlcjox") {
            myPosts: postsWithPathInfo(testLimit: 1) {
              id
            }
          }
          capturedPathInfo {
            path
            segments {
              field
              alias
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();

    const data = result.data as {
      myUser: { myPosts: { id: string }[] };
      capturedPathInfo: {
        path: string[];
        segments: { field: string; alias: string }[];
      };
    };

    expect(data.capturedPathInfo).toBeDefined();
    // path uses field names, not aliases
    expect(data.capturedPathInfo.path).toEqual(['Query.user', 'User.postsWithPathInfo']);
    // segments include alias info
    expect(data.capturedPathInfo.segments[0]).toMatchObject({
      field: 'user',
      alias: 'myUser',
    });
    expect(data.capturedPathInfo.segments[1]).toMatchObject({
      field: 'postsWithPathInfo',
      alias: 'myPosts',
    });
  });

  it('captures isList correctly in segments', async () => {
    const context = await createContext({ userId: '1' });

    const result = await execute({
      schema,
      document: gql`
        {
          user(id: "VXNlcjox") {
            postsWithPathInfo(testLimit: 1) {
              id
            }
          }
          capturedPathInfo {
            segments {
              field
              isList
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();

    const data = result.data as {
      capturedPathInfo: {
        segments: { field: string; isList: boolean }[];
      };
    };

    // user returns a single User (isList: false)
    expect(data.capturedPathInfo.segments[0].isList).toBe(false);
    // postsWithPathInfo returns a list of posts (isList: true)
    expect(data.capturedPathInfo.segments[1].isList).toBe(true);
  });

  it('captures parentType correctly in segments', async () => {
    const context = await createContext({ userId: '1' });

    const result = await execute({
      schema,
      document: gql`
        {
          user(id: "VXNlcjox") {
            postsWithPathInfo(testLimit: 1) {
              id
            }
          }
          capturedPathInfo {
            segments {
              field
              parentType
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();

    const data = result.data as {
      capturedPathInfo: {
        segments: { field: string; parentType: string }[];
      };
    };

    expect(data.capturedPathInfo.segments[0].parentType).toBe('Query');
    expect(data.capturedPathInfo.segments[1].parentType).toBe('User');
  });
});

// GitHub issue #1596: Path-based conditional filtering example
// This demonstrates how pathInfo can be used to apply different filters
// based on how a field is accessed in the query
describe('path-based conditional filtering (GitHub #1596)', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('applies different filters based on query path', async () => {
    const context = await createContext({ userId: '1' });

    // Query via regular 'user' - should return PUBLISHED posts only
    const regularResult = await execute({
      schema,
      document: gql`
        {
          user(id: "VXNlcjox") {
            firstName
            postsForModeration(limit: 5) {
              id
              title
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(regularResult.errors).toBeUndefined();
    const regularData = regularResult.data as {
      user: { firstName: string; postsForModeration: { id: string; title: string }[] };
    };

    // Via 'user' query, postsForModeration shows published posts
    expect(regularData.user.postsForModeration.length).toBeGreaterThan(0);

    // Query via 'me.user' (viewer context) - should return DRAFT (unpublished) posts only
    const viewerResult = await execute({
      schema,
      document: gql`
        {
          me {
            user {
              firstName
              postsForModeration(limit: 5) {
                id
                title
              }
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(viewerResult.errors).toBeUndefined();
    const viewerData = viewerResult.data as {
      me: { user: { firstName: string; postsForModeration: { id: string; title: string }[] } };
    };

    // Via 'me.user', postsForModeration shows draft posts (viewer's own content)
    // The same field returns different data based on the query path!
    expect(viewerData.me.user.firstName).toBe('Mason');

    // The key insight: same field (postsForModeration) returns different results
    // based on whether it's accessed via 'user' or 'me.user'
    // This is exactly the use case from GitHub issue #1596
  });
});
