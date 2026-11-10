// Checked by tsconfig.missing-plugins.json alone: importing relay, with-input or scope-auth anywhere
// in the same program would load their global augmentations and enable these methods.
import SchemaBuilder from '@pothos/core';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf } from 'vitest';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const relayRequired = '@pothos/plugin-relay is required to use this method';
const withInputRequired = '@pothos/plugin-with-input is required to use this method';
const scopeAuthRequired = '@pothos/plugin-scope-auth is required to use this method';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [DrizzlePlugin],
  drizzle: { client: db, getTableConfig, relations },
});

expectTypeOf(builder.drizzleNode).toEqualTypeOf<typeof relayRequired>();
// @ts-expect-error drizzleNode needs plugin-relay
builder.drizzleNode('users', { id: { column: (user) => user.id }, fields: () => ({}) });

builder.drizzleObject('users', {
  fields: (t) => {
    expectTypeOf(t.relatedConnection).toEqualTypeOf<typeof relayRequired>();
    expectTypeOf(t.withAuth).toEqualTypeOf<typeof scopeAuthRequired>();
    return {
      // @ts-expect-error relatedConnection needs plugin-relay
      posts: t.relatedConnection('posts'),
      // @ts-expect-error withAuth needs plugin-scope-auth
      guarded: t.withAuth({ loggedIn: true }).exposeID('id'),
      // Fields that need no other plugin still work.
      id: t.exposeID('id'),
      comments: t.relation('comments'),
      postCount: t.relatedCount('posts'),
    };
  },
});

builder.queryFields((t) => {
  expectTypeOf(t.drizzleConnection).toEqualTypeOf<typeof relayRequired>();
  expectTypeOf(t.drizzleFieldWithInput).toEqualTypeOf<typeof withInputRequired>();
  return {
    // @ts-expect-error drizzleConnection needs plugin-relay
    page: t.drizzleConnection({ type: 'users', resolve: () => [] }),
    // @ts-expect-error drizzleFieldWithInput needs plugin-with-input
    created: t.drizzleFieldWithInput({ type: 'users', input: {}, resolve: () => null }),
    user: t.drizzleField({
      type: 'users',
      nullable: true,
      resolve: (query) => db.query.users.findFirst(query()),
    }),
  };
});
