// A builder without `DrizzleRelations` compiles until it names a table, and the error at the name
// says what to set.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import WithInputPlugin from '@pothos/plugin-with-input';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin, { type DrizzleRelationsHint, drizzleConnectionHelpers } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

type Hint = string & {
  readonly missingDrizzleRelations: 'Set DrizzleRelations on SchemaTypes: new SchemaBuilder<{ DrizzleRelations: typeof relations }>(...)';
};

const builder = new SchemaBuilder<{}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, WithInputPlugin, DrizzlePlugin],
  drizzle: { client: db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

builder.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'world' }) }) });

it('names the missing setup where a table name is expected', () => {
  expectTypeOf<Parameters<typeof builder.drizzleObject>[0]>().toEqualTypeOf<Hint>();
  expectTypeOf<DrizzleRelationsHint<typeof builder.$inferSchemaTypes>>().toEqualTypeOf<Hint>();

  // @ts-expect-error DrizzleRelations is not set
  builder.drizzleObject('users', { fields: () => ({}) });
  // @ts-expect-error DrizzleRelations is not set
  builder.drizzleInterface('users', { fields: () => ({}) });
  builder.drizzleNode(
    // @ts-expect-error DrizzleRelations is not set
    'users',
    { id: { column: () => [] }, fields: () => ({}) },
  );
  builder.drizzleObjectField(
    // @ts-expect-error DrizzleRelations is not set
    'users',
    'a',
    (t) => t.string({ resolve: () => '' }),
  );
  // @ts-expect-error DrizzleRelations is not set
  builder.drizzleObjectFields('users', () => ({}));
  builder.drizzleInterfaceField(
    // @ts-expect-error DrizzleRelations is not set
    'users',
    'a',
    (t) => t.string({ resolve: () => '' }),
  );
  // @ts-expect-error DrizzleRelations is not set
  builder.drizzleInterfaceFields('users', () => ({}));
  // @ts-expect-error DrizzleRelations is not set
  drizzleConnectionHelpers(builder, 'users', {});

  builder.queryFields((t) => ({
    one: t.drizzleField({
      // @ts-expect-error DrizzleRelations is not set
      type: 'users',
      nullable: true,
      resolve: () => null,
    }),
    list: t.drizzleField({
      // @ts-expect-error DrizzleRelations is not set
      type: ['users'],
      resolve: () => [],
    }),
    page: t.drizzleConnection({
      // @ts-expect-error DrizzleRelations is not set
      type: 'users',
      resolve: () => [],
    }),
    withInput: t.drizzleFieldWithInput({
      // @ts-expect-error DrizzleRelations is not set
      type: 'users',
      nullable: true,
      input: {},
      resolve: () => null,
    }),
    query: t.string({
      resolve: (_root, _args, context, info) => {
        // @ts-expect-error DrizzleRelations is not set
        t.drizzleQueryFromInfo('users', { context, info });

        return '';
      },
    }),
  }));
});

it('adds nothing once DrizzleRelations is set', () => {
  const typed = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
    drizzle: { client: db, getTableConfig, relations },
    scopeAuth: { authScopes: () => ({}) },
  });

  expectTypeOf<DrizzleRelationsHint<typeof typed.$inferSchemaTypes>>().toBeNever();
  expectTypeOf<DrizzleRelationsHint<typeof typed.$inferSchemaTypes, true>>().toBeNever();
});
