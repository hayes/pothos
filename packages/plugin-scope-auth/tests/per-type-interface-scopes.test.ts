import SchemaBuilder, { type ObjectRef } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { graphql } from 'graphql';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin, { type TypeScopeInfo } from '../src';
import { db } from './example/db';

interface User {
  id: string;
  name: string;
}

interface Post {
  id: string;
  isDraft: boolean;
  authorId: string;
}

interface Context {
  userId: string | null;
}

const users: User[] = [{ id: 'u1', name: 'Ada' }];
const posts: Post[] = [
  { id: 'p1', isDraft: false, authorId: 'u1' },
  { id: 'p2', isDraft: true, authorId: 'u1' },
];

function createSchema() {
  const builder = new SchemaBuilder<{
    Context: Context;
    AuthScopes: { loggedIn: boolean; author: string };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    relay: {},
    scopeAuth: {
      authScopes: (context) => ({
        loggedIn: !!context.userId,
        author: (id) => id === context.userId,
      }),
    },
  });

  // The helper from the docs.
  function isType<T>(
    ref: ObjectRef<typeof builder.$inferSchemaTypes, unknown, T>,
    node: unknown,
    info: TypeScopeInfo,
  ): node is T {
    return builder.configStore.getTypeConfig(ref).name === info.parentType.name;
  }

  const UserRef = builder.objectRef<User>('User');
  const PostRef = builder.objectRef<Post>('Post');

  builder.node(UserRef, {
    id: { resolve: (user) => user.id },
    loadOne: (id) => users.find((user) => user.id === id),
    fields: (t) => ({ name: t.exposeString('name') }),
  });

  builder.node(PostRef, {
    id: { resolve: (post) => post.id },
    loadOne: (id) => posts.find((post) => post.id === id),
    fields: (t) => ({ isDraft: t.exposeBoolean('isDraft') }),
  });

  builder.nodeInterfaceRef({
    authScopes: (node, _context, info) => {
      switch (true) {
        case isType(UserRef, node, info):
          expectTypeOf(node).toEqualTypeOf<User>();

          return true;
        case isType(PostRef, node, info):
          expectTypeOf(node).toEqualTypeOf<Post>();

          return node.isDraft ? { author: node.authorId } : { loggedIn: true };
        default:
          return false;
      }
    },
  });

  builder.queryType({});

  return builder.toSchema();
}

const globalId = (type: string, id: string) => Buffer.from(`${type}:${id}`).toString('base64');

const source = `
  query {
    user: node(id: "${globalId('User', 'u1')}") { ... on User { name } }
    post: node(id: "${globalId('Post', 'p1')}") { ... on Post { isDraft } }
    draft: node(id: "${globalId('Post', 'p2')}") { ... on Post { isDraft } }
  }
`;

describe('per-type interface scopes', () => {
  it('applies a different policy to each node type', async () => {
    const schema = createSchema();

    const anonymous = await graphql({ schema, source, contextValue: { userId: null } });
    expect(anonymous.data).toEqual({
      user: { name: 'Ada' },
      post: { isDraft: null },
      draft: { isDraft: null },
    });

    const reader = await graphql({ schema, source, contextValue: { userId: 'u2' } });
    expect(reader.data).toEqual({
      user: { name: 'Ada' },
      post: { isDraft: false },
      draft: { isDraft: null },
    });

    const author = await graphql({ schema, source, contextValue: { userId: 'u1' } });
    expect(author).toEqual({
      data: { user: { name: 'Ada' }, post: { isDraft: false }, draft: { isDraft: true } },
    });
  });

  it('matches a ref implemented under a different name', async () => {
    const builder = new SchemaBuilder<{ Context: Context; AuthScopes: { loggedIn: boolean } }>({
      plugins: [ScopeAuthPlugin],
      prisma: { client: db, dmmf: getDatamodel() },
      scopeAuth: { authScopes: (context) => ({ loggedIn: !!context.userId }) },
    });
    const Named = builder.interfaceRef<User>('Named');
    const MemberRef = builder.objectRef<User>('UserRef');

    builder.objectType(MemberRef, {
      name: 'Member',
      interfaces: [Named],
      fields: (t) => ({ name: t.exposeString('name') }),
    });

    Named.implement({
      authScopes: (_parent, _context, info) =>
        builder.configStore.getTypeConfig(MemberRef).name === info.parentType.name,
      fields: (t) => ({ id: t.exposeString('id') }),
    });

    builder.queryType({
      fields: (t) => ({ member: t.field({ type: MemberRef, resolve: () => users[0] }) }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ member { name } }',
      contextValue: { userId: null },
    });

    expect(result).toEqual({ data: { member: { name: 'Ada' } } });
  });
});
