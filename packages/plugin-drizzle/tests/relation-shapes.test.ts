import { execute } from '@pothos/test-utils';
import { and, eq, sql } from 'drizzle-orm';
import { gql } from 'graphql-tag';
import { asPagedAliases, countSubquery } from './count-predicate';
import { comments, posts } from './example/db/schema';
import { client, db } from './relation-shapes/db';
import { schema, unfilteredCountSchema } from './relation-shapes/schema';

const POST_ID = 1;
const USER_ID = 1;

interface Connection {
  totalCount: number;
  edges: { node: { id: string } }[];
}

const statements: string[] = [];
const runStatement = client.execute.bind(client);

// Every statement the schema runs, so a test can look at the SQL and not just the answer.
(client as unknown as { execute: unknown }).execute = (statement: unknown, ...rest: unknown[]) => {
  statements.push(typeof statement === 'string' ? statement : (statement as { sql: string }).sql);

  return (runStatement as (...args: unknown[]) => unknown)(statement, ...rest);
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

describe('relation shapes the count has to reproduce', () => {
  describe('a many-to-many relation defined with `through`', () => {
    it('counts the rows the connection pages over, junction duplicates included', async () => {
      // The relational query builder joins the junction table in, so a commenter who left two
      // comments on the post is two rows of the connection.
      const [{ rows }] = await db
        .select({ rows: sql<number>`count(*)` })
        .from(comments)
        .where(eq(comments.postId, POST_ID));

      expect(rows).toBe(5);

      const data = await query(`
        {
          post(id: ${POST_ID}) {
            commentersConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { post: { commentersConnection: Connection } }).post
        .commentersConnection;

      expect(connection.edges).toHaveLength(rows);
      expect(connection.totalCount).toBe(rows);
    });

    it('counts the same rows when only totalCount is selected', async () => {
      const data = await query(`
        {
          post(id: ${POST_ID}) {
            commentersConnection(first: 100) { totalCount }
          }
        }
      `);

      expect(
        (data as { post: { commentersConnection: Connection } }).post.commentersConnection,
      ).toMatchInlineSnapshot(`
          {
            "totalCount": 5,
          }
        `);
    });

    it('applies the where from the field query on top of the junction', async () => {
      const data = await query(`
        {
          post(id: ${POST_ID}) {
            filteredCommentersConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { post: { filteredCommentersConnection: Connection } }).post
        .filteredCommentersConnection;

      // two of the five junction rows belong to the same commenter, whose id the where excludes
      expect(connection.edges).toHaveLength(3);
      expect(connection.totalCount).toBe(connection.edges.length);
    });

    it('counts distinct related rows for relatedCount and relatedField', async () => {
      // `relatedCount` and a user `select` both filter the target table on its own, so a
      // commenter counts once however many comments they left.
      const [{ distinctCommenters }] = await db
        .select({ distinctCommenters: sql<number>`count(distinct ${comments.authorId})` })
        .from(comments)
        .where(eq(comments.postId, POST_ID));

      expect(distinctCommenters).toBe(4);

      const data = await query(`
        {
          post(id: ${POST_ID}) {
            commentersCount
            commentersFieldCount
          }
        }
      `);

      expect(data).toMatchObject({
        post: {
          commentersCount: distinctCommenters,
          commentersFieldCount: distinctCommenters,
        },
      });
    });

    it('counts distinct rows off the junction rather than scanning the target table', async () => {
      // Counting the target table filtered by the relation says the same thing, but sqlite does
      // not rewrite that `exists` into a semijoin the way postgres does: it scans the target
      // table once per parent row. Reading the junction table by its index instead is the
      // difference between a second and a millisecond over a thousand parents.
      await query(`
        {
          post(id: ${POST_ID}) { commentersCount }
        }
      `);

      expect(onlyStatement()).toContain(
        'count(distinct "users"."id") from "users" inner join "comments" on',
      );
    });
  });

  describe('a reversed relation', () => {
    it('applies the `where` it inherits, which reads off the source table', async () => {
      const data = await query(`
        {
          unpublished: post(id: 1) { publishedAuthorCount }
          published: post(id: 2) { publishedAuthorCount }
        }
      `);

      // post 1 is a draft and post 2 is published, so the inherited `where` decides whether the
      // author counts as related at all
      expect(data).toMatchInlineSnapshot(`
        {
          "published": {
            "publishedAuthorCount": 1,
          },
          "unpublished": {
            "publishedAuthorCount": 0,
          },
        }
      `);
    });
  });

  describe('a relation defined with its own `where`', () => {
    it('counts only the rows the relation selects', async () => {
      const published = await db.$count(
        posts,
        and(eq(posts.authorId, USER_ID), eq(posts.published, 1)),
      );
      const all = await db.$count(posts, eq(posts.authorId, USER_ID));

      expect({ published, all }).toEqual({ published: 9, all: 15 });

      const data = await query(`
        {
          user(id: ${USER_ID}) {
            publishedPostsConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
            publishedPostsCount
          }
        }
      `);

      const user = data as {
        user: { publishedPostsConnection: Connection; publishedPostsCount: number };
      };

      expect(user.user.publishedPostsConnection.edges).toHaveLength(published);
      expect(user.user.publishedPostsConnection.totalCount).toBe(published);
      expect(user.user.publishedPostsCount).toBe(published);
    });

    it('ands the field query where onto the relation where', async () => {
      const publishedInCategory = await db.$count(
        posts,
        and(eq(posts.authorId, USER_ID), eq(posts.published, 1), eq(posts.categoryId, 1)),
      );
      const inCategory = await db.$count(
        posts,
        and(eq(posts.authorId, USER_ID), eq(posts.categoryId, 1)),
      );

      // the two have to differ, or the test could not tell the relation `where` was applied
      expect(publishedInCategory).toBeLessThan(inCategory);

      const data = await query(`
        {
          user(id: ${USER_ID}) {
            publishedPostsWithCategoryConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { user: { publishedPostsWithCategoryConnection: Connection } })
        .user.publishedPostsWithCategoryConnection;

      expect(connection.edges).toHaveLength(publishedInCategory);
      expect(connection.totalCount).toBe(publishedInCategory);
    });
  });

  describe('a plain foreign key relation', () => {
    it('counts every related row without a field where', async () => {
      const all = await db.$count(posts, eq(posts.authorId, USER_ID));

      const data = await query(`
        {
          user(id: ${USER_ID}) {
            postsConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { user: { postsConnection: Connection } }).user.postsConnection;

      expect(connection.edges).toHaveLength(all);
      expect(connection.totalCount).toBe(all);
    });

    it('counts the filtered rows with a field where', async () => {
      const published = await db.$count(
        posts,
        and(eq(posts.authorId, USER_ID), eq(posts.published, 1)),
      );

      const data = await query(`
        {
          user(id: ${USER_ID}) {
            filteredPostsConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const connection = (data as { user: { filteredPostsConnection: Connection } }).user
        .filteredPostsConnection;

      expect(connection.edges).toHaveLength(published);
      expect(connection.totalCount).toBe(published);
    });
  });

  // The failure this guards against is the one the count was written to avoid: two predicates
  // that have to agree, built by different routes, agreeing today and drifting tomorrow. The
  // aliases are renamed because the page query reads the relation inside a subquery of its own,
  // and the rest has to be the same text.
  describe('the count and the page query are the same predicate', () => {
    it('for a many-to-many relation with a field where', async () => {
      await query(`
        {
          post(id: ${POST_ID}) {
            filteredCommentersConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const statement = onlyStatement();

      expect(statement).toContain(
        asPagedAliases(countSubquery(statement), { target: 'users', through: 'comments' }),
      );
    });

    it('for a relation with its own where and a field where', async () => {
      await query(`
        {
          user(id: ${USER_ID}) {
            publishedPostsWithCategoryConnection(first: 100) {
              totalCount
              edges { node { id } }
            }
          }
        }
      `);

      const statement = onlyStatement();

      expect(statement).toContain(asPagedAliases(countSubquery(statement), { target: 'posts' }));
    });
  });

  describe('filterConnectionTotalCount: false', () => {
    it('drops the field query where from the count but keeps the relation', async () => {
      const all = await db.$count(posts, eq(posts.authorId, USER_ID));
      const published = await db.$count(
        posts,
        and(eq(posts.authorId, USER_ID), eq(posts.published, 1)),
      );

      const data = await query(
        `
          {
            user(id: ${USER_ID}) {
              filteredPostsConnection(first: 100) {
                totalCount
                edges { node { id } }
              }
              publishedPostsWithCategoryConnection(first: 100) {
                totalCount
              }
            }
          }
        `,
        unfilteredCountSchema,
      );

      const user = (
        data as {
          user: {
            filteredPostsConnection: Connection;
            publishedPostsWithCategoryConnection: Connection;
          };
        }
      ).user;

      // the field's `where` is ignored: every related post is counted
      expect(user.filteredPostsConnection.edges).toHaveLength(published);
      expect(user.filteredPostsConnection.totalCount).toBe(all);
      // the relation's own `where` is part of the relation, not the field's filter, so it stays
      expect(user.publishedPostsWithCategoryConnection.totalCount).toBe(published);
    });

    it('still counts a many-to-many relation through its junction table', async () => {
      const data = await query(
        `
          {
            post(id: ${POST_ID}) {
              filteredCommentersConnection(first: 100) { totalCount }
            }
          }
        `,
        unfilteredCountSchema,
      );

      expect(
        (data as { post: { filteredCommentersConnection: Connection } }).post,
      ).toMatchInlineSnapshot(`
          {
            "filteredCommentersConnection": {
              "totalCount": 5,
            },
          }
        `);
    });
  });
});
