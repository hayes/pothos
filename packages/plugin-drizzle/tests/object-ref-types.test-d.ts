import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { user?: { id: number } };
  AuthScopes: { loggedIn: boolean };
  AuthContexts: { loggedIn: { user: { id: number } } };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: (ctx) => ({ loggedIn: !!ctx.user }) },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    // `withAuth` narrows the context to the scope's auth context, and keeps the drizzle methods
    isMe: t.withAuth({ loggedIn: true }).boolean({
      resolve: (user, _args, ctx) => {
        expectTypeOf(ctx.user).toEqualTypeOf<{ id: number }>();

        return user.id === ctx.user.id;
      },
    }),
    posts: t.withAuth({ loggedIn: true }).relation('posts'),
  }),
});

const UserNode = builder.drizzleNode('users', {
  name: 'UserNode',
  id: { column: (user) => user.id },
  fields: (t) => ({ username: t.exposeString('username') }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({ id: t.exposeID('postId') }),
});

it('types drizzleConnection with an object or node ref like the table name', () => {
  builder.queryType({
    fields: (t) => ({
      byObjectRef: t.drizzleConnection({
        type: User,
        resolve: (query) => db.query.users.findMany(query()),
      }),
      byNodeRef: t.drizzleConnection({
        type: UserNode,
        resolve: (query) => db.query.users.findMany(query()),
      }),
      byTableName: t.drizzleConnection({
        type: 'users',
        resolve: (query) => db.query.users.findMany(query()),
      }),
    }),
  });
});

it('accepts a withAuth field from drizzleObjectField', () => {
  builder.drizzleObjectField(User, 'withAuthField', (t) =>
    t.withAuth({ loggedIn: true }).exposeString('username'),
  );
});

it('accepts object and node refs in variant after withAuth', () => {
  builder.drizzleObjectField(User, 'nodeVariant', (t) =>
    t.withAuth({ loggedIn: true }).variant(UserNode),
  );
  builder.drizzleObjectField(UserNode, 'objectVariant', (t) =>
    t.withAuth({ loggedIn: true }).variant(User),
  );
});

it('accepts a ref in drizzleQueryFromInfo after withAuth', () => {
  builder.queryField('fromInfo', (t) => {
    const authed = t.withAuth({ loggedIn: true });

    return authed.boolean({
      resolve: (_root, _args, context, info) => {
        authed.drizzleQueryFromInfo(User, { context, info });

        return true;
      },
    });
  });
});
