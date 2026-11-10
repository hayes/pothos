import SchemaBuilder, { PothosSchemaError } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { GraphQLError } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

function createBuilder() {
  return new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
    drizzle: { client: () => db, getTableConfig, relations },
    relay: {},
    scopeAuth: { authScopes: () => ({}) },
  });
}

async function runOne(
  schema: ReturnType<ReturnType<typeof createBuilder>['toSchema']>,
  query: string,
) {
  const result = await execute({ schema, document: gql(query), contextValue: {} });

  expect(result.errors).toHaveLength(1);

  return result.errors![0] as GraphQLError;
}

describe('mistakes in the app that surface at request time', () => {
  it('rejects a type-level select naming a relation the table does not have at build', () => {
    const builder = createBuilder();

    const define = () =>
      builder.drizzleObject('users', {
        name: 'User',
        select: { with: { posts: true, followers: true } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });

    expect(define).toThrow(PothosSchemaError);
    expect(define).toThrow(
      'The select of drizzleObject User includes relation "followers", which table users does not have',
    );
  });

  it('names drizzleNode when a node select names a relation the table does not have', () => {
    const builder = createBuilder();

    const define = () =>
      builder.drizzleNode('users', {
        name: 'UserNode',
        id: { column: (user) => user.id },
        select: { with: { posts: true, followers: true } },
        fields: (t) => ({ firstName: t.exposeString('firstName', { nullable: true }) }),
      });

    expect(define).toThrow(PothosSchemaError);
    expect(define).toThrow(
      'The select of drizzleNode UserNode includes relation "followers", which table users does not have',
    );
  });

  it('rejects an interface select naming a relation the table does not have at build', () => {
    const builder = createBuilder();

    const define = () =>
      builder.drizzleInterface('users', {
        name: 'IUser',
        select: { with: { posts: true, followers: true } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });

    expect(define).toThrow(PothosSchemaError);
    expect(define).toThrow(
      'The select of drizzleInterface IUser includes relation "followers", which table users does not have',
    );
  });

  it('names the table of a nested relation the select gets wrong', () => {
    const builder = createBuilder();

    const define = () =>
      builder.drizzleObject('users', {
        name: 'User',
        select: { with: { posts: { with: { author: true, nope: true } } } },
        fields: (t) => ({ id: t.exposeID('id') }),
      });

    expect(define).toThrow(
      'The select of drizzleObject User includes relation "nope", which table posts does not have',
    );
  });

  it('hides a field select naming a relation the table does not have', async () => {
    const builder = createBuilder();
    const User = builder.drizzleObject('users', {
      name: 'User',
      fields: (t) => ({
        postCount: t.int({
          select: { with: { posts: true, followers: true } },
          resolve: (user) => user.posts.length,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.drizzleField({
          type: User,
          resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
        }),
      }),
    });

    const error = await runOne(builder.toSchema(), '{ user { postCount } }');

    expect(error.message).toBe('Unexpected error.');
    expect((error.originalError?.cause as Error).message).toBe(
      'Relation followers does not exist on users',
    );
  });

  it('hides a parent row that lacks the key it is reloaded by', async () => {
    const builder = createBuilder();
    const User = builder.drizzleObject('users', {
      name: 'User',
      select: { columns: { firstName: true } },
      fields: (t) => ({
        lastName: t.string({
          nullable: true,
          select: { columns: { lastName: true } },
          resolve: (user) => user.lastName,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.field({
          type: User,
          resolve: () => ({ firstName: 'Mason' }),
        }),
      }),
    });

    const error = await runOne(builder.toSchema(), '{ user { lastName } }');

    expect(error.message).toBe('Unexpected error.');
    expect((error.originalError?.cause as Error).message).toBe(
      'Primary key column id not found on users',
    );
  });
});
