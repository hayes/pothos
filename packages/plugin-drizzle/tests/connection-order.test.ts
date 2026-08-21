import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, db, drizzleLogs } from './example/db';
import { posts } from './example/db/schema';
import { schema } from './example/schema';

const query = gql`
  query ($first: Int!, $after: String) {
    postsByAuthor(first: $first, after: $after) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
        }
      }
    }
  }
`;

// postsByAuthor is ordered by authorId, which is not unique. Walking the whole
// connection should still visit every post exactly once.
async function paginate(first: number) {
  const context = await createContext({ userId: '1' });
  const ids: string[] = [];
  let after: string | null = null;

  for (let requests = 0; requests < 1000; requests++) {
    const result = (await execute({
      schema,
      document: query,
      contextValue: context,
      variableValues: { first, after },
    })) as {
      errors?: readonly Error[];
      data: {
        postsByAuthor: {
          pageInfo: { endCursor: string | null; hasNextPage: boolean };
          edges: { node: { id: string } }[];
        };
      };
    };

    expect(result.errors).toBeUndefined();

    const { pageInfo, edges } = result.data.postsByAuthor;

    ids.push(...edges.map((edge) => edge.node.id));

    if (!pageInfo.hasNextPage) {
      return ids;
    }

    after = pageInfo.endCursor;
  }

  throw new Error('pagination did not terminate');
}

describe('connections ordered by a non-unique column', () => {
  it('visits every row exactly once', async () => {
    const total = await db.$count(posts);
    const ids = await paginate(7);

    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });

  it('returns the same rows in the same order for any page size', async () => {
    expect(await paginate(7)).toStrictEqual(await paginate(23));
  });
});

describe('connections ordered by a unique column', () => {
  it('does not add a tie breaker', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: gql`
        query {
          usersByUsername(first: 2) {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();
    expect(drizzleLogs[0]).toContain('order by "d0"."username" asc limit');
  });
});

describe('cursors issued before the tie breaker existed', () => {
  it('pages from the columns the cursor covers', async () => {
    const context = await createContext({ userId: '1' });

    // postsByAuthor now orders by (authorId, id); this cursor only names an
    // authorId, the way it would have been issued before the tie breaker
    const legacyCursor = Buffer.from('DC:N:5').toString('base64');

    const result = (await execute({
      schema,
      document: query,
      contextValue: context,
      variableValues: { first: 3, after: legacyCursor },
    })) as {
      errors?: readonly Error[];
      data: { postsByAuthor: { edges: { node: { id: string } }[] } };
    };

    expect(result.errors).toBeUndefined();
    expect(result.data.postsByAuthor.edges).not.toHaveLength(0);
  });
});

const byTitleLength = gql`
  query ($first: Int!, $after: String) {
    postsByTitleLength(first: $first, after: $after) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
        }
      }
    }
  }
`;

describe('connections ordered by a selected expression', () => {
  it('visits every row exactly once', async () => {
    const context = await createContext({ userId: '1' });
    const total = await db.$count(posts);
    const ids: string[] = [];
    let after: string | null = null;

    for (let requests = 0; requests < 1000; requests++) {
      const result = (await execute({
        schema,
        document: byTitleLength,
        contextValue: context,
        variableValues: { first: 9, after },
      })) as {
        errors?: readonly Error[];
        data: {
          postsByTitleLength: {
            pageInfo: { endCursor: string | null; hasNextPage: boolean };
            edges: { node: { id: string } }[];
          };
        };
      };

      expect(result.errors).toBeUndefined();

      const { pageInfo, edges } = result.data.postsByTitleLength;

      ids.push(...edges.map((edge) => edge.node.id));

      if (!pageInfo.hasNextPage) {
        break;
      }

      after = pageInfo.endCursor;
    }

    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });

  it('orders and compares on the expression, not a column', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();

    await execute({
      schema,
      document: byTitleLength,
      contextValue: context,
      variableValues: { first: 2, after: null },
    });

    expect(drizzleLogs[0]).toContain('order by length("d0"."title") asc, "d0"."id" asc');
  });

  it('rejects an orderBy naming neither a column nor an extra', async () => {
    const context = await createContext({ userId: '1' });

    const result = (await execute({
      schema,
      document: gql`
        query {
          postsMissingOrderByExtra(first: 2) {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
      contextValue: context,
    })) as { errors?: readonly Error[] };

    expect(result.errors?.[0]?.message).toContain('has no such column');
  });
});

describe('expression ordering across connection APIs', () => {
  it('works through a related connection', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();

    const result = (await execute({
      schema,
      document: gql`
        query {
          user(id: "VXNlcjox") {
            postsByTitleLengthConnection(first: 3) {
              edges {
                cursor
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: context,
    })) as {
      errors?: readonly Error[];
      data: { user: { postsByTitleLengthConnection: { edges: { cursor: string }[] } } };
    };

    expect(result.errors).toBeUndefined();
    expect(result.data.user.postsByTitleLengthConnection.edges).not.toHaveLength(0);
    expect(drizzleLogs.join('\n')).toContain('order by length("d1"."title") asc');

    // the cursor carries the expression value alongside the appended primary key
    const [{ cursor }] = result.data.user.postsByTitleLengthConnection.edges;
    expect(Buffer.from(cursor, 'base64').toString()).toMatch(/^DC:T:\["N:\d+","N:\d+"\]$/);
  });

  it('works through drizzleConnectionHelpers', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();

    const result = (await execute({
      schema,
      document: gql`
        query {
          rolesByIdLengthConnection(userId: 1, first: 2) {
            edges {
              cursor
              node {
                id
              }
            }
          }
        }
      `,
      contextValue: context,
    })) as {
      errors?: readonly Error[];
      data: { rolesByIdLengthConnection: { edges: { cursor: string }[] } };
    };

    expect(result.errors).toBeUndefined();
    expect(result.data.rolesByIdLengthConnection.edges).not.toHaveLength(0);
    expect(drizzleLogs.join('\n')).toContain('cast("d0"."role_id" as text)');
  });
});

describe('connections ordered by a nullable column', () => {
  it('does not crash when the cursor value is null', async () => {
    const context = await createContext({ userId: '1' });

    const first = (await execute({
      schema,
      document: gql`
        query {
          postsBySlug(first: 1) {
            pageInfo {
              endCursor
            }
            edges {
              node {
                id
              }
            }
          }
        }
      `,
      contextValue: context,
    })) as {
      errors?: readonly Error[];
      data: { postsBySlug: { pageInfo: { endCursor: string } } };
    };

    expect(first.errors).toBeUndefined();

    const { endCursor } = first.data.postsBySlug.pageInfo;
    // sqlite orders nulls first, so the cursor names a row with no slug
    expect(Buffer.from(endCursor, 'base64').toString()).toContain('null');

    const second = (await execute({
      schema,
      document: gql`
        query ($after: String) {
          postsBySlug(first: 2, after: $after) {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
      contextValue: context,
      variableValues: { after: endCursor },
    })) as { errors?: readonly Error[]; data: { postsBySlug: { edges: unknown[] } } };

    // Paging past a null used to throw a TypeError out of drizzle. It no longer
    // does, but the page is empty: `slug > null` is unknown in SQL, so no row
    // compares after one whose ordering value is null. Ordering by a nullable
    // column cannot be paged, and the docs say so.
    expect(second.errors).toBeUndefined();
    expect(second.data.postsBySlug.edges).toHaveLength(0);
  });
});
