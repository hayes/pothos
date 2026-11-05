import SchemaBuilder from '@pothos/core';
import { type GraphQLObjectType, type GraphQLResolveInfo, graphql, graphqlSync } from 'graphql';
import { vi } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin, { type ScopeAuthParentLoader } from '../src';
import { db } from './example/db';

interface Row {
  id: string;
  owner?: string;
}

function createSchema({
  loadParent,
  isTypeOf,
  unauthorizedError,
}: {
  loadParent?: ScopeAuthParentLoader<{ user: string }>;
  isTypeOf?: (value: unknown) => boolean;
  unauthorizedError?: (parent: unknown) => string;
} = {}) {
  const authScopes = vi.fn((parent: Row, _context: { user: string }) => ({
    user: parent.owner ?? '',
  }));
  const builder = new SchemaBuilder<{
    Context: { user: string };
    AuthScopes: { user: string };
  }>({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      authScopes: (context) => ({ user: (name) => name === context.user }),
      unauthorizedError,
    },
  });
  const Item = builder.objectRef<Row>('Item').implement({
    runScopesOnType: true,
    authScopes,
    isTypeOf,
    extensions: loadParent ? { pothosScopeAuthParent: loadParent } : undefined,
    fields: (t) => ({ id: t.exposeID('id') }),
  });
  // Without a resolveType, graphql picks the member by calling each member's isTypeOf.
  const ItemUnion = builder.unionType('ItemUnion', { types: [Item] });
  builder.queryType({
    fields: (t) => ({
      item: t.field({ type: Item, nullable: true, resolve: () => ({ id: '1' }) }),
      union: t.field({ type: ItemUnion, nullable: true, resolve: () => ({ id: '1' }) }),
    }),
  });

  return { schema: builder.toSchema(), authScopes };
}

const source = '{ item { id } }';

describe('pothosScopeAuthParent', () => {
  it('passes type scopes the parent a sync loader returns', async () => {
    const loadParent = vi.fn((parent: unknown) => ({ ...(parent as Row), owner: 'alice' }));
    const { schema, authScopes } = createSchema({ loadParent });

    const allowed = await graphql({ schema, source, contextValue: { user: 'alice' } });
    expect(allowed).toEqual({ data: { item: { id: '1' } } });
    expect(authScopes).toHaveBeenCalledWith({ id: '1', owner: 'alice' }, { user: 'alice' });
    expect(loadParent).toHaveBeenCalledWith({ id: '1' }, { user: 'alice' }, expect.anything());

    const denied = await graphql({ schema, source, contextValue: { user: 'bob' } });
    expect(denied.data).toEqual({ item: null });
    expect(denied.errors).toHaveLength(1);
  });

  it('checks a sync loader result synchronously', () => {
    const { schema } = createSchema({
      loadParent: (parent) => ({ ...(parent as Row), owner: 'alice' }),
    });
    const type = schema.getType('Item') as GraphQLObjectType;

    expect(type.isTypeOf?.({ id: '1' }, { user: 'alice' }, {} as never)).toBe(true);
  });

  it('awaits an async loader result', async () => {
    const { schema, authScopes } = createSchema({
      loadParent: (parent) => Promise.resolve({ ...(parent as Row), owner: 'alice' }),
    });

    const allowed = await graphql({ schema, source, contextValue: { user: 'alice' } });
    expect(allowed).toEqual({ data: { item: { id: '1' } } });
    expect(authScopes.mock.calls[0][0]).toEqual({ id: '1', owner: 'alice' });

    const denied = await graphql({ schema, source, contextValue: { user: 'bob' } });
    expect(denied.data).toEqual({ item: null });
    expect(denied.errors).toHaveLength(1);
  });

  it('passes the type isTypeOf the value it was given', async () => {
    const isTypeOf = vi.fn(() => true);
    const { schema } = createSchema({
      loadParent: (parent) => ({ ...(parent as Row), owner: 'alice' }),
      isTypeOf,
    });

    const result = await graphql({ schema, source, contextValue: { user: 'alice' } });
    expect(result).toEqual({ data: { item: { id: '1' } } });
    expect(isTypeOf).toHaveBeenCalledWith({ id: '1' }, { user: 'alice' }, expect.anything());
  });

  it('fails the check when the loader rejects', async () => {
    const { schema, authScopes } = createSchema({
      loadParent: () => Promise.reject(new Error('load failed')),
    });

    const result = await graphql({ schema, source, contextValue: { user: 'alice' } });
    expect(result.data).toEqual({ item: null });
    expect(result.errors?.map((error) => error.message)).toEqual(['load failed']);
    expect(authScopes).not.toHaveBeenCalled();
  });

  it('passes the unauthorized error the loaded parent', async () => {
    const unauthorizedError = vi.fn((_parent: unknown) => 'denied');
    const { schema } = createSchema({
      loadParent: (parent) => ({ ...(parent as Row), owner: 'alice' }),
      unauthorizedError,
    });

    const result = await graphql({ schema, source, contextValue: { user: 'bob' } });
    expect(result.data).toEqual({ item: null });
    expect(result.errors?.map((error) => error.message)).toEqual(['denied']);
    expect(unauthorizedError.mock.calls[0][0]).toEqual({ id: '1', owner: 'alice' });
  });

  it("doesn't call the loader while resolving an abstract type", async () => {
    const loadParent = vi.fn((parent: unknown) => ({ ...(parent as Row), owner: 'alice' }));
    const isTypeOf = vi.fn(() => true);
    const { schema } = createSchema({ loadParent, isTypeOf });

    const result = await graphql({
      schema,
      source: '{ union { ... on Item { id } } }',
      contextValue: { user: 'alice' },
    });
    expect(result).toEqual({ data: { union: { id: '1' } } });
    // Once to pick the member, and once to check the chosen type.
    expect(isTypeOf).toHaveBeenCalledTimes(2);
    expect(loadParent).toHaveBeenCalledTimes(1);
  });

  it('passes type scopes the row without a loader', async () => {
    const { schema, authScopes } = createSchema();

    const result = await graphql({ schema, source, contextValue: { user: 'alice' } });
    expect(result.data).toEqual({ item: null });
    expect(result.errors).toHaveLength(1);
    expect(authScopes.mock.calls[0][0]).toEqual({ id: '1' });
  });

  // graphql-jit can't run here: it requires its own copy of graphql, which rejects the schema's
  // types. Once an object type is chosen, it calls `isTypeOf` with only the value, and treats any
  // promise it returns as a match.
  describe('called as graphql-jit calls it', () => {
    function isTypeOfFor(schema: ReturnType<typeof createSchema>['schema']) {
      const type = schema.getType('Item') as GraphQLObjectType;

      return (value: unknown) => (type.isTypeOf as (value: unknown) => unknown)(value);
    }

    it('fails the check without calling the loader', () => {
      // Reads `info`, which graphql-jit doesn't pass.
      const loadParent = vi.fn((parent: unknown, _context: unknown, info: GraphQLResolveInfo) => ({
        ...(parent as Row),
        owner: info.schema ? 'alice' : '',
      }));
      const { schema, authScopes } = createSchema({ loadParent });

      expect(isTypeOfFor(schema)({ id: '1' })).toBe(false);
      expect(loadParent).not.toHaveBeenCalled();
      expect(authScopes).not.toHaveBeenCalled();
    });
  });
});

describe('pothosScopeAuthParent for field checks', () => {
  function createFieldSchema(loadParent: ScopeAuthParentLoader<{ user: string }>) {
    const seen: [string, unknown][] = [];
    const builder = new SchemaBuilder<{
      Context: { user: string };
      AuthScopes: { user: string };
    }>({
      plugins: [ScopeAuthPlugin],
      prisma: { client: db, dmmf: getDatamodel() },
      scopeAuth: { authScopes: (context) => ({ user: (name) => name === context.user }) },
    });
    const Named = builder.interfaceRef<Row>('Named').implement({
      fields: (t) => ({
        inherited: t.string({
          authScopes: (parent) => {
            seen.push(['inherited', parent]);
            return { user: parent.owner ?? '' };
          },
          resolve: (parent) => (parent.owner ? 'loaded' : 'original'),
        }),
      }),
    });
    const Item = builder.objectRef<Row>('Item').implement({
      interfaces: [Named],
      authScopes: (parent) => {
        seen.push(['type', parent]);
        return { user: parent.owner ?? '' };
      },
      grantScopes: (parent) => {
        seen.push(['grants', parent]);
        return [];
      },
      extensions: { pothosScopeAuthParent: loadParent },
      fields: (t) => ({
        field: t.string({
          skipTypeScopes: true,
          authScopes: (parent) => {
            seen.push(['field', parent]);
            return { user: parent.owner ?? '' };
          },
          grantScopes: (parent) => {
            seen.push(['fieldGrants', parent]);
            return [];
          },
          resolve: (parent) => (parent.owner ? 'loaded' : 'original'),
        }),
        a: t.string({ resolve: () => 'a' }),
        b: t.string({ resolve: () => 'b' }),
      }),
    });
    // Its checks read no parent, so they don't load one.
    const Plain = builder.objectRef<Row>('Plain').implement({
      authScopes: { user: 'alice' },
      extensions: { pothosScopeAuthParent: loadParent },
      fields: (t) => ({
        mapped: t.string({ authScopes: { user: 'alice' }, resolve: () => 'mapped' }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        item: t.field({ type: Item, nullable: true, resolve: () => ({ id: '1' }) }),
        plain: t.field({ type: Plain, nullable: true, resolve: () => ({ id: '1' }) }),
      }),
    });

    return { schema: builder.toSchema(), seen };
  }

  const loaded = { id: '1', owner: 'alice' };

  it('passes field checks the loaded parent, and the resolver the original', async () => {
    const loadParent = vi.fn(() => loaded);
    const { schema, seen } = createFieldSchema(loadParent);

    const result = await graphql({
      schema,
      source: '{ item { field inherited } }',
      contextValue: { user: 'alice' },
    });
    expect(result).toEqual({ data: { item: { field: 'original', inherited: 'original' } } });
    expect(seen).toEqual(
      expect.arrayContaining([
        ['field', loaded],
        ['fieldGrants', loaded],
        ['inherited', loaded],
        ['type', loaded],
        ['grants', loaded],
      ]),
    );
    expect(seen.every(([, parent]) => parent === loaded)).toBe(true);
  });

  it('runs type checks once per row across fields', async () => {
    const loadParent = vi.fn(() => Promise.resolve(loaded));
    const { schema, seen } = createFieldSchema(loadParent);

    const result = await graphql({
      schema,
      source: '{ item { a b } }',
      contextValue: { user: 'alice' },
    });
    expect(result).toEqual({ data: { item: { a: 'a', b: 'b' } } });
    expect(seen.filter(([kind]) => kind === 'type')).toHaveLength(1);
    expect(seen.filter(([kind]) => kind === 'grants')).toHaveLength(1);
  });

  it('denies a field check that fails on the loaded parent', async () => {
    const { schema } = createFieldSchema(() => Promise.resolve(loaded));

    const result = await graphql({
      schema,
      source: '{ item { field } }',
      contextValue: { user: 'bob' },
    });
    expect(result.data).toEqual({ item: { field: null } });
    expect(result.errors).toHaveLength(1);
  });

  it("doesn't load the parent for checks that don't read it", async () => {
    const loadParent = vi.fn(() => loaded);
    const { schema } = createFieldSchema(loadParent);

    const result = await graphql({
      schema,
      source: '{ plain { mapped } }',
      contextValue: { user: 'alice' },
    });
    expect(result).toEqual({ data: { plain: { mapped: 'mapped' } } });
    expect(loadParent).not.toHaveBeenCalled();
  });

  it('resolves synchronously with a sync loader', () => {
    const { schema } = createFieldSchema(() => loaded);

    expect(
      graphqlSync({ schema, source: '{ item { field a } }', contextValue: { user: 'alice' } }),
    ).toEqual({ data: { item: { field: 'original', a: 'a' } } });
  });
});
