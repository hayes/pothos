import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { asPagedAliases, countSubquery, withoutPlaceholderNumbers } from './count-predicate';
import { db, queryClient } from './postgres/db';
import { schema, unfilteredCountSchema } from './postgres/relation-shapes/schema';
import { type RelationShapesFixture, seedRelationShapes } from './postgres/relation-shapes/seed';

interface Connection {
  totalCount: number;
  edges: { node: { id: string } }[];
}

let fixture: RelationShapesFixture;

const statements: string[] = [];

// Every statement the schema runs, so a test can look at the SQL and not just the answer.
const session = Object.getPrototypeOf((db as unknown as { _: { session: object } })._.session) as {
  prepareQuery: (...args: unknown[]) => unknown;
};
const prepareQuery = session.prepareQuery;

session.prepareQuery = function patched(this: unknown, ...args: unknown[]) {
  statements.push((args[0] as { sql: string }).sql);

  return prepareQuery.apply(this, args);
};

async function query(document: string, target = schema) {
  statements.length = 0;

  const result = await execute({
    schema: target,
    document: gql(document),
    contextValue: {},
  });

  expect(result.errors).toBeUndefined();

  return result.data as never;
}

function onlyStatement() {
  expect(statements).toHaveLength(1);

  return statements[0] as string;
}

// The sqlite twin of these cases lives in `relation-shapes.test.ts`. Both dialects are covered
// because the SQL the plugin's count goes into is not the same on each: postgres pages a
// relation with a lateral join and sqlite with a correlated json subquery, and postgres returns
// `count(*)` as a bigint where sqlite returns an integer.
describe('relation shapes the count has to reproduce, on postgres', () => {
  beforeAll(async () => {
    fixture = await seedRelationShapes();
  });

  afterAll(async () => {
    await queryClient.end();
  });

  describe('a many-to-many relation defined with `through`', () => {
    it('counts the rows the connection pages over, junction duplicates included', async () => {
      const data = await query(`
        {
          post(id: ${fixture.sharedPostId}) {
            commentersConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { post: { commentersConnection: Connection } }).post
        .commentersConnection;

      // four comments from three commenters: the connection pages over junction rows
      expect(connection.edges).toHaveLength(4);
      expect(connection.totalCount).toBe(4);
    });

    it('counts the same rows when only totalCount is selected', async () => {
      const data = await query(`
        {
          post(id: ${fixture.sharedPostId}) {
            commentersConnection(first: 100) { totalCount }
          }
        }
      `);

      expect(
        (data as { post: { commentersConnection: Connection } }).post.commentersConnection,
      ).toEqual({ totalCount: 4 });
    });

    it('returns the count as a number, not the bigint postgres counts with', async () => {
      const data = await query(`
        {
          post(id: ${fixture.sharedPostId}) {
            commentersConnection(first: 100) { totalCount }
          }
        }
      `);

      expect(
        typeof (data as { post: { commentersConnection: Connection } }).post.commentersConnection
          .totalCount,
      ).toBe('number');
    });

    it('applies the where from the field query on top of the junction', async () => {
      const data = await query(`
        {
          post(id: ${fixture.sharedPostId}) {
            filteredCommentersConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { post: { filteredCommentersConnection: Connection } }).post
        .filteredCommentersConnection;

      // the where keeps ada and alan and drops grace, and ada's two junction rows both stay
      expect(connection.edges).toHaveLength(3);
      expect(connection.totalCount).toBe(3);
    });

    it('counts every junction row when filterConnectionTotalCount is off', async () => {
      const data = await query(
        `
        {
          post(id: ${fixture.sharedPostId}) {
            filteredCommentersConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `,
        unfilteredCountSchema,
      );

      const connection = (data as { post: { filteredCommentersConnection: Connection } }).post
        .filteredCommentersConnection;

      expect(connection.totalCount).toBe(4);
      expect(connection.edges.length).toBeLessThan(connection.totalCount);
    });

    it('counts distinct related rows for relatedCount', async () => {
      const data = await query(`
        {
          post(id: ${fixture.sharedPostId}) { commentersCount }
        }
      `);

      // three distinct commenters behind the four junction rows
      expect(data).toEqual({ post: { commentersCount: 3 } });
    });
  });

  // The sqlite twin of this pair is in `relation-shapes.test.ts`. It matters more here: postgres
  // is the dialect the junction SQL has never run on, and the two predicates go into a lateral
  // join rather than a correlated subquery.
  describe('the count and the page query are the same predicate', () => {
    it('for a many-to-many relation with a field where', async () => {
      await query(`
        {
          post(id: ${fixture.sharedPostId}) {
            filteredCommentersConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const statement = withoutPlaceholderNumbers(onlyStatement());

      expect(statement).toContain(
        asPagedAliases(countSubquery(statement), { target: 'users', through: 'comments' }),
      );
    });

    it('for a relation with its own where and a field where', async () => {
      await query(`
        {
          user(id: ${fixture.authorId}) {
            publishedPostsInvitedConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const statement = withoutPlaceholderNumbers(onlyStatement());

      expect(statement).toContain(asPagedAliases(countSubquery(statement), { target: 'posts' }));
    });
  });

  describe('a reversed relation', () => {
    it('applies the `where` it inherits, which reads off the source table', async () => {
      const [publishedPostId, , , draftPostId] = fixture.postIds as [
        number,
        number,
        number,
        number,
      ];

      const data = await query(`
        {
          published: post(id: ${publishedPostId}) { publishedAuthorCount }
          draft: post(id: ${draftPostId}) { publishedAuthorCount }
        }
      `);

      expect(data).toEqual({
        published: { publishedAuthorCount: 1 },
        draft: { publishedAuthorCount: 0 },
      });
    });
  });

  describe('a relation defined with its own `where`', () => {
    it('counts only the rows the relation selects', async () => {
      const data = await query(`
        {
          user(id: ${fixture.authorId}) {
            postsConnection(first: 100) { totalCount }
            publishedPostsConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
            publishedPostsCount
          }
        }
      `);

      const user = (
        data as {
          user: {
            postsConnection: Connection;
            publishedPostsConnection: Connection;
            publishedPostsCount: number;
          };
        }
      ).user;

      // five posts by this author, three of them published
      expect(user.postsConnection.totalCount).toBe(5);
      expect(user.publishedPostsConnection.edges).toHaveLength(3);
      expect(user.publishedPostsConnection.totalCount).toBe(3);
      expect(user.publishedPostsCount).toBe(3);
    });

    it('ands the field query where onto the relation where', async () => {
      const data = await query(`
        {
          user(id: ${fixture.authorId}) {
            publishedPostsInvitedConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { user: { publishedPostsInvitedConnection: Connection } }).user
        .publishedPostsInvitedConnection;

      expect(connection.edges).toHaveLength(3);
      expect(connection.totalCount).toBe(3);
    });
  });
});
