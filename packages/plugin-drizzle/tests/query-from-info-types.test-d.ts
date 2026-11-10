// Rows loaded with `t.drizzleQueryFromInfo` can be returned from a field of the table's type, as
// the docs show; rows from a query the helper did not build still can't.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({ id: t.exposeID('id') }),
});

const asyncBuilder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  AsyncSelections: true;
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

const AsyncUser = asyncBuilder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({ id: t.exposeID('id') }),
});

it('returns rows loaded with drizzleQueryFromInfo from a field of the type', () => {
  builder.queryFields((t) => ({
    user: t.field({
      type: User,
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (_root, args, context, info) =>
        db.query.users.findFirst(
          t.drizzleQueryFromInfo('users', {
            context,
            info,
            columns: { id: true },
            where: { id: args.id },
          }),
        ),
    }),
    byRef: t.field({
      type: [User],
      resolve: (_root, _args, context, info) =>
        db.query.users.findMany(t.drizzleQueryFromInfo(User, { context, info, limit: 10 })),
    }),
    withExtras: t.field({
      type: User,
      nullable: true,
      resolve: async (_root, _args, context, info) => {
        const user = await db.query.users.findFirst(
          t.drizzleQueryFromInfo('users', {
            context,
            info,
            extras: { upper: (users) => sql<string>`upper(${users.username})` },
          }),
        );
        expectTypeOf(user!.upper).toEqualTypeOf<string>();

        return user;
      },
    }),
  }));

  asyncBuilder.queryFields((t) => ({
    user: t.field({
      type: AsyncUser,
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: async (_root, args, context, info) =>
        db.query.users.findFirst(
          await t.drizzleQueryFromInfo('users', {
            context,
            info,
            where: { id: args.id },
          }),
        ),
    }),
  }));
});

it('still rejects rows the helper did not load', () => {
  builder.queryFields((t) => ({
    plainQuery: t.field({
      type: User,
      nullable: true,
      resolve: () =>
        // @ts-expect-error a query that selects only some columns, not built by the helper
        db.query.users.findFirst({ columns: { id: true } }),
    }),
    plainObject: t.field({
      type: User,
      // @ts-expect-error an object without the columns the type needs
      resolve: () => ({ id: 1 }),
    }),
    otherTable: t.field({
      type: User,
      nullable: true,
      resolve: (_root, _args, context, info) =>
        // @ts-expect-error rows the helper loaded for another table
        db.query.posts.findFirst(
          t.drizzleQueryFromInfo('posts', { context, info, columns: { postId: true } }),
        ),
    }),
  }));
});
