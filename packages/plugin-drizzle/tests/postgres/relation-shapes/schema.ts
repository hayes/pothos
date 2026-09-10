import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/pg-core';
import DrizzlePlugin from '../../../src';
import { type DrizzleRelations, db, relations } from '../db';
import { users } from '../db/schema';

interface Types {
  DrizzleRelations: DrizzleRelations;
}

// The postgres twin of `tests/relation-shapes/schema.ts`. The relation shapes the count has to
// reproduce are the same, but the SQL drizzle emits for them is not: postgres pages a relation
// with a lateral join and sqlite with a correlated json subquery, so the count has to hold up
// against both.
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
      username: t.exposeString('name', { nullable: true }),
      // a plain foreign key relation, for comparison
      postsConnection: t.relatedConnection('posts', {
        totalCount: true,
        query: () => ({ orderBy: { id: 'asc' } }),
      }),
      // the relation carries its own `where`
      publishedPostsConnection: t.relatedConnection('publishedPosts', {
        totalCount: true,
        query: () => ({ orderBy: { id: 'asc' } }),
      }),
      publishedPostsInvitedConnection: t.relatedConnection('publishedPosts', {
        totalCount: true,
        query: () => ({ where: { authorId: { gt: 0 } }, orderBy: { id: 'asc' } }),
      }),
      publishedPostsCount: t.relatedCount('publishedPosts'),
    }),
  });

  builder.drizzleNode('posts', {
    name: 'Post',
    id: { column: (post) => post.id },
    fields: (t) => ({
      content: t.exposeString('content', { nullable: true }),
      // many-to-many, through the comments table
      commentersConnection: t.relatedConnection('commenters', {
        totalCount: true,
        query: () => ({ orderBy: { id: 'asc' } }),
      }),
      filteredCommentersConnection: t.relatedConnection('commenters', {
        totalCount: true,
        query: () => ({ where: { name: { like: 'a%' } }, orderBy: { id: 'asc' } }),
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
    }),
  });

  builder.queryType({
    fields: (t) => ({
      post: t.drizzleField({
        type: 'posts',
        args: { id: t.arg.int({ required: true }) },
        resolve: (query, _root, { id }) => db.query.posts.findFirst(query({ where: { id } })),
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
