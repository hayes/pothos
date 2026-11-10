import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

// An exposed column the row holds is read from the row, so resolving it looks up no mapping.
const getLoaderMapping = vi.hoisted(() => vi.fn());

vi.mock('@pothos/selection-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pothos/selection-mapper')>();

  getLoaderMapping.mockImplementation(actual.getLoaderMapping);

  return { ...actual, getLoaderMapping };
});

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    postId: t.exposeInt('postId'),
    title: t.exposeString('title'),
    slug: t.exposeString('slug', { nullable: true }),
    published: t.exposeInt('published'),
  }),
});

builder.queryType({
  fields: (t) => ({
    posts: t.drizzleField({
      type: [Post],
      resolve: (query) => db.query.posts.findMany(query({ limit: 10, orderBy: { postId: 'asc' } })),
    }),
  }),
});

const schema = builder.toSchema();

it('looks up no mapping for exposed columns of planned rows', async () => {
  getLoaderMapping.mockClear();

  const result = await execute({
    schema,
    document: gql`
      {
        posts {
          postId
          title
          slug
          published
        }
      }
    `,
    contextValue: {},
  });

  expect(result.errors).toBeUndefined();
  expect(result.data?.posts).toHaveLength(10);
  expect(getLoaderMapping).not.toHaveBeenCalled();
});
