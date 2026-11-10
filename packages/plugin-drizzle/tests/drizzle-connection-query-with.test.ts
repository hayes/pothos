import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

// `drizzleConnection` hands its resolver a `query()` that accepts the relational query's `with`.
// The relations named there are loaded onto the rows the resolver gets back, beside whatever the
// document selects for the same relation.
const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    username: t.exposeString('username'),
    firstName: t.exposeString('firstName', { nullable: true }),
  }),
});

builder.drizzleObject('comments', {
  name: 'Comment',
  fields: (t) => ({ id: t.exposeInt('id') }),
});

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeInt('postId'),
    author: t.relation('author'),
    // A `comments` selection whose arguments differ from the resolver's own `with`.
    lastComment: t.relation('comments', {
      query: { orderBy: { id: 'desc' }, limit: 1 },
    }),
  }),
});

// What each resolver saw on its rows, keyed by the field.
const seen: Record<string, unknown[]> = {};

builder.queryType({
  fields: (t) => ({
    postsWithAuthor: t.drizzleConnection({
      type: Post,
      resolve: async (query) => {
        const rows = await db.query.posts.findMany(
          query({ with: { author: true }, orderBy: { postId: 'asc' } }),
        );
        seen.postsWithAuthor = rows.map((row) => row.author);
        return rows;
      },
    }),
    postsWithAuthorUsername: t.drizzleConnection({
      type: Post,
      resolve: async (query) => {
        const rows = await db.query.posts.findMany(
          query({
            with: { author: { columns: { username: true } } },
            orderBy: { postId: 'asc' },
          }),
        );
        seen.postsWithAuthorUsername = rows.map((row) => row.author);
        return rows;
      },
    }),
    postsWithFirstComment: t.drizzleConnection({
      type: Post,
      resolve: async (query) => {
        const rows = await db.query.posts.findMany(
          query({
            with: { comments: { orderBy: { id: 'asc' }, limit: 1 } },
            orderBy: { postId: 'asc' },
          }),
        );
        seen.postsWithFirstComment = rows.map((row) => row.comments.map((comment) => comment.id));
        return rows;
      },
    }),
  }),
});

const schema = builder.toSchema();

describe('drizzleConnection query({ with })', () => {
  it('loads the relations the resolver asks for', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          postsWithAuthor(first: 2) {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();

    // A page of `first: 2` reads one row more, to tell whether there is a next page.
    const expected = await db.query.posts.findMany({
      with: { author: true },
      orderBy: { postId: 'asc' },
      limit: 3,
    });

    expect(seen.postsWithAuthor).toEqual(expected.map((row) => row.author));
  });

  it('merges a relation the document also selects', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          postsWithAuthorUsername(first: 2) {
            edges {
              node {
                id
                author {
                  firstName
                }
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();

    const expected = await db.query.posts.findMany({
      with: { author: true },
      orderBy: { postId: 'asc' },
      limit: 3,
    });

    // The resolver's own column and the document's are both on the row.
    for (const [index, author] of seen.postsWithAuthorUsername.entries()) {
      expect(author).toMatchObject({
        username: expected[index].author!.username,
        firstName: expected[index].author!.firstName,
      });
    }

    expect(result.data).toEqual({
      postsWithAuthorUsername: {
        edges: expected.slice(0, 2).map((row) => ({
          node: { id: row.postId, author: { firstName: row.author!.firstName } },
        })),
      },
    });
  });

  it('keeps both sides of a relation selected with different arguments', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          postsWithFirstComment(first: 3) {
            edges {
              node {
                id
                lastComment {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();

    const expected = await db.query.posts.findMany({
      with: {
        comments: { orderBy: { id: 'asc' }, limit: 1 },
      },
      orderBy: { postId: 'asc' },
      limit: 4,
    });
    const last = await db.query.posts.findMany({
      with: {
        comments: { orderBy: { id: 'desc' }, limit: 1 },
      },
      orderBy: { postId: 'asc' },
      limit: 3,
    });

    // The resolver sees the comments it asked for ...
    expect(seen.postsWithFirstComment).toEqual(
      expected.map((row) => row.comments.map((comment) => comment.id)),
    );
    // ... and the field resolves the ones it asked for.
    expect(result.data).toEqual({
      postsWithFirstComment: {
        edges: last.map((row) => ({
          node: {
            id: row.postId,
            lastComment: row.comments.map((comment) => ({ id: comment.id })),
          },
        })),
      },
    });
  });
});
