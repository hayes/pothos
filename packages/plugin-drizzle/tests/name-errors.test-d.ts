// A misspelled column, relation or table name is rejected at the name itself, with an error that
// lists the names that fit.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import WithInputPlugin from '@pothos/plugin-with-input';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { it } from 'vitest';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, WithInputPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({ id: t.exposeID('id') }),
});

it('rejects a column name that does not fit', () => {
  builder.drizzleObjectFields(User, (t) => ({
    // @ts-expect-error not a column of users
    a: t.exposeString('nme'),
    // @ts-expect-error not a column of users
    b: t.exposeID('nme'),
    // @ts-expect-error not a column of users
    c: t.exposeInt('nme'),
    // @ts-expect-error not a column of users
    d: t.exposeFloat('nme'),
    // @ts-expect-error not a column of users
    e: t.expose('nme', { type: 'String' }),
    // @ts-expect-error users has no list columns
    f: t.exposeStringList('nme'),
    // @ts-expect-error a column of users, but not an Int
    g: t.exposeInt('username'),
  }));
});

it('rejects a relation name that does not fit', () => {
  builder.drizzleObjectFields(User, (t) => ({
    // @ts-expect-error not a relation of users
    a: t.relatedConnection('psts'),
    // @ts-expect-error a relation of users, but not a list
    b: t.relatedConnection('profile'),
    // @ts-expect-error not a relation of users
    c: t.relatedCount('psts'),
    // @ts-expect-error not a relation of users
    d: t.relation('psts'),
    e: t.relatedField(
      // @ts-expect-error not a relation of users
      'psts',
      { type: 'Int', select: () => ({}), resolve: () => 1 },
    ),
    // @ts-expect-error not a variant of users
    f: t.variant('usrs'),
  }));
});

it('rejects a table name that does not exist', () => {
  // @ts-expect-error not a table
  builder.drizzleObject('usrs', { fields: () => ({}) });
  // @ts-expect-error not a table
  builder.drizzleInterface('usrs', { fields: () => ({}) });
  builder.drizzleNode(
    // @ts-expect-error not a table
    'usrs',
    { id: { column: () => [] }, fields: () => ({}) },
  );
  builder.drizzleObjectField(
    // @ts-expect-error not a table
    'usrs',
    'a',
    (t) => t.string({ resolve: () => '' }),
  );
  // @ts-expect-error not a table
  builder.drizzleObjectFields('usrs', () => ({}));
  builder.drizzleInterfaceField(
    // @ts-expect-error not a table
    'usrs',
    'a',
    (t) => t.string({ resolve: () => '' }),
  );
  // @ts-expect-error not a table
  builder.drizzleInterfaceFields('usrs', () => ({}));
  // @ts-expect-error not a table
  drizzleConnectionHelpers(builder, 'usrs', {});

  builder.queryFields((t) => ({
    one: t.drizzleField({
      // @ts-expect-error not a table
      type: 'usrs',
      nullable: true,
      resolve: () => null,
    }),
    list: t.drizzleField({
      // @ts-expect-error not a table
      type: ['usrs'],
      resolve: () => [],
    }),
    page: t.drizzleConnection({
      // @ts-expect-error not a table
      type: 'usrs',
      resolve: () => [],
    }),
    withInput: t.drizzleFieldWithInput({
      // @ts-expect-error not a table
      type: 'usrs',
      nullable: true,
      input: {},
      resolve: () => null,
    }),
    query: t.string({
      resolve: (_root, _args, context, info) => {
        // @ts-expect-error not a table
        t.drizzleQueryFromInfo('usrs', { context, info });

        return '';
      },
    }),
  }));
});
