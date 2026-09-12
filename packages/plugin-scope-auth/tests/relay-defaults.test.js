import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { graphql } from 'graphql';
import ScopeAuthPlugin from '../src';

function createSchema(policy) {
  let loads = 0;
  const article = { id: '1', title: 'A field guide' };
  const builder = new SchemaBuilder({
    plugins: [ScopeAuthPlugin, RelayPlugin],
    relay: {
      ...(policy === 'root'
        ? {
            nodeQueryOptions: { authScopes: { loggedIn: true } },
            nodesQueryOptions: { authScopes: { loggedIn: true } },
          }
        : {}),
      ...(policy === 'interface' ? { nodeTypeOptions: { authScopes: { loggedIn: true } } } : {}),
      ...(policy === 'disabled' ? { nodeQueryOptions: false, nodesQueryOptions: false } : {}),
    },
    scopeAuth: {
      authScopes: (context) => context,
      unauthorizedError: () => new Error('Not authorized'),
    },
  });
  const Article = builder.objectRef('Article');
  builder.node(Article, {
    id: { resolve: (value) => value.id },
    loadOne: () => {
      loads += 1;
      return article;
    },
    authScopes: { canRead: true },
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.queryType({
    ...(policy === 'query' ? { authScopes: { loggedIn: true } } : {}),
    fields: (t) => ({
      article: t.field({ type: Article, resolve: () => article }),
      publicMessage: t.string({ skipTypeScopes: true, resolve: () => 'Hello' }),
    }),
  });
  return { schema: builder.toSchema(), loads: () => loads };
}

const id = 'QXJ0aWNsZTox';

describe('Relay authorization defaults', () => {
  it.each([
    'node',
    'nodes',
  ])('root %s scopes deny before loading, including typename-only reads', async (field) => {
    const fixture = createSchema('root');
    const selection = field === 'node' ? `node(id: "${id}")` : `nodes(ids: ["${id}"])`;
    const result = await graphql({
      schema: fixture.schema,
      source: `{ ${selection} { __typename } }`,
      contextValue: { loggedIn: false, canRead: true },
    });
    expect(result.errors?.map((error) => error.path)).toEqual([[field]]);
    expect(fixture.loads()).toBe(0);
  });

  it('interface scopes protect normal object fields through both root and direct paths', async () => {
    const fixture = createSchema('interface');
    const result = await graphql({
      schema: fixture.schema,
      source: `{ article { title } node(id: "${id}") { ... on Article { title } } }`,
      contextValue: { loggedIn: false, canRead: true },
    });
    expect(result.errors?.map((error) => error.path)).toEqual([
      ['article', 'title'],
      ['node', 'title'],
    ]);
    expect(fixture.loads()).toBe(1);
  });

  it('interface scopes do not gate loads or typename-only reads by default', async () => {
    const fixture = createSchema('interface');
    const result = await graphql({
      schema: fixture.schema,
      source: `{ node(id: "${id}") { __typename } }`,
      contextValue: { loggedIn: false, canRead: true },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { __typename: 'Article' } });
    expect(fixture.loads()).toBe(1);
  });

  it('object scopes still apply after the interface baseline is satisfied', async () => {
    const fixture = createSchema('interface');
    const result = await graphql({
      schema: fixture.schema,
      source: '{ article { title } }',
      contextValue: { loggedIn: true, canRead: false },
    });
    expect(result.errors?.[0].path).toEqual(['article', 'title']);
  });

  it('Query defaults gate generated node fields and allow explicit public exceptions', async () => {
    const fixture = createSchema('query');
    const result = await graphql({
      schema: fixture.schema,
      source: `{ publicMessage node(id: "${id}") { __typename } }`,
      contextValue: { loggedIn: false, canRead: true },
    });
    expect(result.data).toEqual({ publicMessage: 'Hello', node: null });
    expect(result.errors?.[0].path).toEqual(['node']);
    expect(fixture.loads()).toBe(0);
  });

  it('both generated lookup fields can be disabled while keeping Node implementors', () => {
    const fixture = createSchema('disabled');
    const fields = fixture.schema.getQueryType().getFields();
    expect(fields.node).toBeUndefined();
    expect(fields.nodes).toBeUndefined();
    expect(fixture.schema.getType('Node')).toBeDefined();
  });
});
