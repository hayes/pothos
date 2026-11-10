import SchemaBuilder, { type SchemaTypes } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import type { TableRelationalConfig } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import { expectTypeOf } from 'vitest';
import DrizzlePlugin, { DrizzleObjectFieldBuilder } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

declare module '../src' {
  export interface DrizzleObjectFieldBuilder<
    Types extends SchemaTypes,
    TableConfig extends TableRelationalConfig,
    Shape,
    ExposableShape,
  > {
    /** Added by another plugin to the `t` of drizzle type fields. */
    testTableName(): TableConfig['name'];
  }
}

DrizzleObjectFieldBuilder.prototype.testTableName = function testTableName(this: {
  table: string;
}) {
  return this.table;
};

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

// Each way of handing `t` to user code: a resolver returns the merged method's result.
const tableField = (table: string) => ({
  type: 'String' as const,
  resolve: () => table,
});

const Viewer = builder.drizzleInterface('users', {
  name: 'Viewer',
  resolveType: () => 'User',
  fields: (t) => {
    expectTypeOf(t.testTableName()).toEqualTypeOf<'users'>();
    return { fromInterface: t.field(tableField(t.testTableName())) };
  },
});

const User = builder.drizzleObject('users', {
  variant: 'User',
  interfaces: [Viewer],
  fields: (t) => {
    expectTypeOf(t.testTableName()).toEqualTypeOf<'users'>();
    return { fromObject: t.field(tableField(t.testTableName())) };
  },
});

const PostNode = builder.drizzleNode('posts', {
  name: 'PostNode',
  id: { column: (post) => post.postId },
  fields: (t) => {
    expectTypeOf(t.testTableName()).toEqualTypeOf<'posts'>();
    return { fromNode: t.field(tableField(t.testTableName())) };
  },
});

builder.drizzleObjectField(User, 'fromObjectField', (t) => {
  expectTypeOf(t.testTableName()).toEqualTypeOf<'users'>();
  return t.field(tableField(t.testTableName()));
});

builder.drizzleObjectFields('posts', (t) => {
  expectTypeOf(t.testTableName()).toEqualTypeOf<'posts'>();
  return { fromObjectFields: t.field(tableField(t.testTableName())) };
});

builder.drizzleInterfaceField(Viewer, 'fromInterfaceField', (t) => {
  expectTypeOf(t.testTableName()).toEqualTypeOf<'users'>();
  return t.field(tableField(t.testTableName()));
});

builder.drizzleInterfaceFields('users', (t) => {
  expectTypeOf(t.testTableName()).toEqualTypeOf<'users'>();
  return { fromInterfaceFields: t.field(tableField(t.testTableName())) };
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    post: t.drizzleField({
      type: PostNode,
      resolve: (query) => db.query.posts.findFirst(query({ where: { postId: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('field builder extensions', () => {
  it('calls a method merged onto DrizzleObjectFieldBuilder from every `t`', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            fromObject
            fromInterface
            fromObjectField
            fromInterfaceField
            fromInterfaceFields
          }
          post {
            fromNode
            fromObjectFields
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({
      data: {
        user: {
          fromObject: 'users',
          fromInterface: 'users',
          fromObjectField: 'users',
          fromInterfaceField: 'users',
          fromInterfaceFields: 'users',
        },
        post: { fromNode: 'posts', fromObjectFields: 'posts' },
      },
    });
  });
});
