// Rows loaded with `t.drizzleQueryFromInfo` can be returned from a field of the table's type, as
// the docs show; rows from a query the helper did not build, or built for another table, still
// can't.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { type SQL, sql } from 'drizzle-orm';
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

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({ id: t.exposeID('postId') }),
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

  builder.queryFields((t) => ({
    noQueryKeys: t.field({
      type: [User],
      resolve: (_root, _args, context, info) =>
        db.query.users.findMany(t.drizzleQueryFromInfo('users', { context, info })),
    }),
    noQueryKeysFirst: t.field({
      type: User,
      nullable: true,
      resolve: (_root, _args, context, info) =>
        db.query.users.findFirst(t.drizzleQueryFromInfo('users', { context, info })),
    }),
    noQueryKeysRef: t.field({
      type: [User],
      resolve: (_root, _args, context, info) =>
        db.query.users.findMany(t.drizzleQueryFromInfo(User, { context, info })),
    }),
    withPath: t.field({
      type: [User],
      resolve: (_root, _args, context, info) =>
        db.query.users.findMany(t.drizzleQueryFromInfo('users', { context, info, path: ['x'] })),
    }),
    optionsVariable: t.field({
      type: [User],
      resolve: (_root, _args, context, info) => {
        const options = { context, info };

        return db.query.users.findMany(t.drizzleQueryFromInfo('users', options));
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

it('types the query and rows like the query of drizzleField', () => {
  builder.queryFields((t) => ({
    user: t.field({
      type: User,
      nullable: true,
      resolve: async (_root, _args, context, info) => {
        const query = t.drizzleQueryFromInfo('users', {
          context,
          info,
          extras: { lower: (users) => sql<string>`lower(${users.username})` },
          with: { posts: { columns: { title: true } } },
        });

        expectTypeOf(query.extras.$pothosQueryFor).toEqualTypeOf<SQL<'users' | undefined>>();

        const user = await db.query.users.findFirst(query);

        expectTypeOf(user).toEqualTypeOf<
          | { lower: string; $pothosQueryFor: 'users' | undefined; posts: { title: string }[] }
          | undefined
        >();
        expectTypeOf<keyof NonNullable<typeof user>>().toEqualTypeOf<
          'lower' | '$pothosQueryFor' | 'posts'
        >();

        return user;
      },
    }),
    users: t.field({
      type: [User],
      resolve: async (_root, _args, context, info) => {
        const users = await db.query.users.findMany(
          t.drizzleQueryFromInfo('users', { context, info }),
        );

        expectTypeOf(users).toEqualTypeOf<{ $pothosQueryFor: 'users' | undefined }[]>();

        return users;
      },
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
    otherTableRef: t.field({
      type: [User],
      resolve: (_root, _args, context, info) =>
        // @ts-expect-error rows the helper loaded for another table's type
        db.query.posts.findMany(t.drizzleQueryFromInfo(Post, { context, info })),
    }),
    extrasReplaced: t.field({
      type: [User],
      resolve: (_root, _args, context, info) =>
        // @ts-expect-error the spread's extras replace the helper's
        db.query.users.findMany({
          ...t.drizzleQueryFromInfo('users', { context, info, limit: 1 }),
          extras: { upper: sql<string>`1` },
        }),
    }),
  }));
});
