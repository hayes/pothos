import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin from '../../src';
import { users } from '../example/db/schema';
import { type DrizzleRelations, db, relations } from './db';

interface Types {
  DrizzleRelations: DrizzleRelations;
}

function buildSchema(filterConnectionTotalCount: boolean) {
  const builder = new SchemaBuilder<Types>({
    plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
    drizzle: {
      client: db,
      getTableConfig,
      relations,
      filterConnectionTotalCount,
    },
    scopeAuth: {
      authScopes: () => ({}),
    },
  });

  builder.drizzleNode('users', {
    name: 'User',
    id: { column: (user) => user.id },
    fields: (t) => ({
      username: t.exposeString('username'),
      // a plain foreign key relation, for comparison
      postsConnection: t.relatedConnection('posts', {
        totalCount: true,
        query: () => ({ orderBy: { postId: 'asc' } }),
      }),
      filteredPostsConnection: t.relatedConnection('posts', {
        totalCount: true,
        query: () => ({ where: { published: 1 }, orderBy: { postId: 'asc' } }),
      }),
      // the relation carries its own `where`
      publishedPostsConnection: t.relatedConnection('publishedPosts', {
        totalCount: true,
        query: () => ({ orderBy: { postId: 'asc' } }),
      }),
      publishedPostsWithCategoryConnection: t.relatedConnection('publishedPosts', {
        totalCount: true,
        query: () => ({ where: { categoryId: 1 }, orderBy: { postId: 'asc' } }),
      }),
      publishedPostsCount: t.relatedCount('publishedPosts'),
    }),
  });

  builder.drizzleNode('posts', {
    name: 'Post',
    id: { column: (post) => post.postId },
    fields: (t) => ({
      title: t.exposeString('title'),
      // many-to-many, through the comments table
      commentersConnection: t.relatedConnection('commenters', {
        totalCount: true,
        query: () => ({ orderBy: { id: 'asc' } }),
      }),
      filteredCommentersConnection: t.relatedConnection('commenters', {
        totalCount: true,
        query: () => ({ where: { id: { lt: 60 } }, orderBy: { id: 'asc' } }),
      }),
      // `relatedCount` and `relatedField` build the same relation filter, but for a query that
      // only has the target table in scope
      commentersCount: t.relatedCount('commenters'),
      // a reversed relation: the `where` it inherits reads off the post, not the user
      publishedAuthorCount: t.relatedField('publishedAuthor', {
        type: 'Int',
        select: (buildFilter) => ({
          extras: {
            publishedAuthorCount: (parent) => db.$count(users, buildFilter(parent)),
          },
        }),
        resolve: (post) => post.publishedAuthorCount,
      }),
      commentersFieldCount: t.relatedField('commenters', {
        type: 'Int',
        select: (buildFilter) => ({
          extras: {
            commentersFieldCount: (parent) => db.$count(users, buildFilter(parent)),
          },
        }),
        resolve: (post) => post.commentersFieldCount,
      }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      post: t.drizzleField({
        type: 'posts',
        args: { id: t.arg.int({ required: true }) },
        resolve: (query, _root, { id }) =>
          db.query.posts.findFirst(query({ where: { postId: id } })),
      }),
      user: t.drizzleField({
        type: 'users',
        args: { id: t.arg.int({ required: true }) },
        resolve: (query, _root, { id }) => db.query.users.findFirst(query({ where: { id } })),
      }),
    }),
  });

  return builder.toSchema();
}

export const schema = buildSchema(true);
export const unfilteredCountSchema = buildSchema(false);
