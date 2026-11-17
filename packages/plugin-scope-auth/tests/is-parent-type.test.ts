import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { graphql } from 'graphql';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin, { isParentType } from '../src';
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

  builder.nodeInterfaceOptions({
    authScopes: (node, _context, info) => {
      switch (true) {
        case isParentType(UserRef, node, info):
          expectTypeOf(node).toEqualTypeOf<User>();

          return true;
        case isParentType(PostRef, node, info):
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

describe('isParentType', () => {
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

  it('rejects refs that are not object types', () => {
    const builder = new SchemaBuilder<{ AuthScopes: {} }>({
      plugins: [ScopeAuthPlugin],
      prisma: { client: db, dmmf: getDatamodel() },
      scopeAuth: { authScopes: () => ({}) },
    });
    const Named = builder.interfaceRef<{ name: string }>('Named');

    expectTypeOf(isParentType).parameter(0).not.toMatchTypeOf(Named);
  });
});
