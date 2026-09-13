import SchemaBuilder from '@pothos/core';
import { type GraphQLResolveInfo, graphql } from 'graphql';
import RelayPlugin, { encodeGlobalID, resolveNodes, resolveUncachedNodesForType } from '../src';

describe('node identity for parsed ids', () => {
  it('keeps parsed object ids distinct', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const User = builder.objectRef<{ id: number; name: string }>('User');

    builder.node(User, {
      id: { resolve: (user) => user.id, parse: (id) => ({ key: Number(id) }) },
      loadOne: (id) => ({ id: id.key, name: `User ${id.key}` }),
      fields: (t) => ({ name: t.exposeString('name') }),
    });

    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: 'query($ids: [ID!]!) { nodes(ids: $ids) { ... on User { name } } }',
      variableValues: { ids: [encodeGlobalID('User', '1'), encodeGlobalID('User', '2')] },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ nodes: [{ name: 'User 1' }, { name: 'User 2' }] });
  });

  it('keeps parsed Date ids within the same second distinct', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const Event = builder.objectRef<{ at: Date }>('Event');

    builder.node(Event, {
      id: {
        parse: (id) => new Date(id),
        resolve: (value) => value.at.toISOString(),
      },
      loadOne: (at) => ({ at }),
      fields: (t) => ({ at: t.string({ resolve: (value) => value.at.toISOString() }) }),
    });

    builder.queryType({});

    const dates = ['2026-01-01T00:00:00.001Z', '2026-01-01T00:00:00.002Z'];

    const result = await graphql({
      schema: builder.toSchema(),
      source: 'query($ids: [ID!]!) { nodes(ids: $ids) { ... on Event { at } } }',
      variableValues: { ids: dates.map((id) => encodeGlobalID('Event', id)) },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ nodes: [{ at: dates[0] }, { at: dates[1] }] });
  });

  it('keeps parsed bigint and class instance ids distinct', async () => {
    class Key {
      constructor(readonly value: string) {}
    }

    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const Big = builder.objectRef<{ id: bigint }>('Big');
    builder.node(Big, {
      id: { resolve: (value) => String(value.id), parse: (id) => BigInt(id) },
      loadOne: (id) => ({ id }),
      fields: (t) => ({ value: t.string({ resolve: (value) => String(value.id) }) }),
    });

    const Keyed = builder.objectRef<{ key: Key }>('Keyed');
    builder.node(Keyed, {
      id: { resolve: (value) => value.key.value, parse: (id) => new Key(id) },
      loadOne: (key) => ({ key }),
      fields: (t) => ({ value: t.string({ resolve: (value) => value.key.value }) }),
    });

    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: `query($ids: [ID!]!) {
        nodes(ids: $ids) { ... on Big { value } ... on Keyed { value } }
      }`,
      variableValues: {
        ids: [
          encodeGlobalID('Big', '1'),
          encodeGlobalID('Big', '2'),
          encodeGlobalID('Keyed', 'a'),
          encodeGlobalID('Keyed', 'b'),
        ],
      },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      nodes: [{ value: '1' }, { value: '2' }, { value: 'a' }, { value: 'b' }],
    });
  });

  it('still caches a parsed id across node and nodes in one request', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const calls: unknown[] = [];

    const User = builder.objectRef<{ id: number }>('User');

    builder.node(User, {
      isTypeOf: () => true,
      id: { resolve: (user) => user.id, parse: (id) => ({ key: Number(id) }) },
      loadOne: (id) => {
        calls.push(id);

        return { id: id.key };
      },
      fields: (t) => ({ key: t.int({ resolve: (user) => user.id }) }),
    });

    builder.queryType({});

    const id = encodeGlobalID('User', '1');

    const result = await graphql({
      schema: builder.toSchema(),
      source: `query($id: ID!, $ids: [ID!]!) {
        first: node(id: $id) { ... on User { key } }
        second: node(id: $id) { ... on User { key } }
        many: nodes(ids: $ids) { ... on User { key } }
      }`,
      variableValues: { id, ids: [id, id] },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      first: { key: 1 },
      second: { key: 1 },
      many: [{ key: 1 }, { key: 1 }],
    });
    expect(calls).toHaveLength(1);
  });

  it('reuses externally primed nodes without id.parse', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const calls: unknown[] = [];

    const User = builder.objectRef<{ id: string }>('User');

    builder.node(User, {
      isTypeOf: () => true,
      id: { resolve: (user) => user.id },
      loadOne: (id) => {
        calls.push(id);

        return { id: String(id) };
      },
      fields: (t) => ({ key: t.exposeString('id') }),
    });

    builder.queryType({});

    const schema = builder.toSchema();
    const context = {};

    await resolveUncachedNodesForType(builder, context, {} as GraphQLResolveInfo, ['1'], 'User');

    expect(calls).toEqual(['1']);

    const result = await graphql({
      schema,
      source: 'query($id: ID!) { node(id: $id) { ... on User { key } } }',
      variableValues: { id: encodeGlobalID('User', '1') },
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { key: '1' } });
    expect(calls).toEqual(['1']);
  });

  it('dedupes repeated ids in a single nodes query with a parsed id', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const batches: unknown[][] = [];

    const User = builder.objectRef<{ id: number }>('User');

    builder.node(User, {
      id: { resolve: (user) => user.id, parse: (id) => ({ key: Number(id) }) },
      loadMany: (ids) => {
        batches.push(ids);

        return ids.map((id) => ({ id: id.key }));
      },
      fields: (t) => ({ key: t.int({ resolve: (user) => user.id }) }),
    });

    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: 'query($ids: [ID!]!) { nodes(ids: $ids) { ... on User { key } } }',
      variableValues: {
        ids: [
          encodeGlobalID('User', '1'),
          encodeGlobalID('User', '1'),
          encodeGlobalID('User', '2'),
        ],
      },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ nodes: [{ key: 1 }, { key: 1 }, { key: 2 }] });
    expect(batches).toEqual([[{ key: 1 }, { key: 2 }]]);
  });

  describe('a GlobalIDShape and a global ID string for the same node', () => {
    function build() {
      const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

      const calls: unknown[] = [];

      const User = builder.objectRef<{ id: number }>('User');

      builder.node(User, {
        isTypeOf: () => true,
        id: { resolve: (user) => user.id, parse: (id) => ({ key: Number(id) }) },
        loadOne: (id) => {
          calls.push(id);

          return { id: id.key };
        },
        fields: (t) => ({ key: t.int({ nullable: true, resolve: (user) => user.id }) }),
      });

      builder.queryType({
        fields: (t) => ({
          shape: t.node({ id: () => ({ id: '1', type: User }) }),
          str: t.node({ id: () => encodeGlobalID('User', '1') }),
        }),
      });

      return { schema: builder.toSchema(), calls };
    }

    it.each([
      ['shape first', '{ a: shape { ...F } b: str { ...F } }'],
      ['string first', '{ a: str { ...F } b: shape { ...F } }'],
    ])('resolves both to the parsed id with %s', async (_name, selection) => {
      const { schema, calls } = build();

      const result = await graphql({
        schema,
        source: `${selection} fragment F on User { key }`,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ a: { key: 1 }, b: { key: 1 } });
      expect(calls).toEqual([{ key: 1 }]);
    });

    it('resolves a root node field alongside a shape-supplied field', async () => {
      const { schema, calls } = build();

      const result = await graphql({
        schema,
        source: `query($id: ID!) {
          a: shape { ... on User { key } }
          b: node(id: $id) { ... on User { key } }
        }`,
        variableValues: { id: encodeGlobalID('User', '1') },
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ a: { key: 1 }, b: { key: 1 } });
      expect(calls).toEqual([{ key: 1 }]);
    });
  });
  describe('global IDs that parse to the same id', () => {
    function build() {
      const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

      const batches: unknown[][] = [];

      const User = builder.objectRef<{ id: number }>('User');

      builder.node(User, {
        isTypeOf: () => true,
        id: { resolve: (user) => user.id, parse: (id) => Number(id) },
        loadMany: (ids) => {
          batches.push([...ids]);

          return ids.map((id) => ({ id: id as number }));
        },
        fields: (t) => ({ num: t.int({ resolve: (user) => user.id }) }),
      });

      builder.queryType({});

      return { schema: builder.toSchema(), batches };
    }

    it('loads the node once for a single nodes query', async () => {
      const { schema, batches } = build();

      const result = await graphql({
        schema,
        source: 'query($ids: [ID!]!) { nodes(ids: $ids) { ... on User { num } } }',
        variableValues: {
          ids: [
            encodeGlobalID('User', '1'),
            encodeGlobalID('User', '01'),
            encodeGlobalID('User', '2'),
          ],
        },
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(batches).toEqual([[1, 2]]);
      expect(result.data).toEqual({ nodes: [{ num: 1 }, { num: 1 }, { num: 2 }] });
    });

    it('loads the node once across separate node fields', async () => {
      const { schema, batches } = build();

      const result = await graphql({
        schema,
        source: `query($a: ID!, $b: ID!) {
          a: node(id: $a) { ... on User { num } }
          b: node(id: $b) { ... on User { num } }
        }`,
        variableValues: { a: encodeGlobalID('User', '1'), b: encodeGlobalID('User', '01') },
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(batches).toEqual([[1]]);
      expect(result.data).toEqual({ a: { num: 1 }, b: { num: 1 } });
    });
  });

  it('still loads object ids that stringify alike as separate nodes', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const batches: unknown[][] = [];

    const User = builder.objectRef<{ id: number }>('User');

    builder.node(User, {
      id: { resolve: (user) => user.id, parse: (id) => ({ key: Number(id) }) },
      loadMany: (ids) => {
        batches.push([...ids]);

        return ids.map((id) => ({ id: id.key }));
      },
      fields: (t) => ({ key: t.int({ resolve: (user) => user.id }) }),
    });

    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: 'query($ids: [ID!]!) { nodes(ids: $ids) { ... on User { key } } }',
      variableValues: { ids: [encodeGlobalID('User', '1'), encodeGlobalID('User', '2')] },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(batches).toEqual([[{ key: 1 }, { key: 2 }]]);
    expect(result.data).toEqual({ nodes: [{ key: 1 }, { key: 2 }] });
  });

  it('still loads Date ids in the same second as separate nodes', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const batches: unknown[][] = [];

    const Event = builder.objectRef<{ at: Date }>('Event');

    builder.node(Event, {
      id: { resolve: (value) => value.at.toISOString(), parse: (id) => new Date(id) },
      loadMany: (ids) => {
        batches.push([...ids]);

        return ids.map((at) => ({ at }));
      },
      fields: (t) => ({ at: t.string({ resolve: (value) => value.at.toISOString() }) }),
    });

    builder.queryType({});

    const dates = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.500Z'];

    const result = await graphql({
      schema: builder.toSchema(),
      source: 'query($ids: [ID!]!) { nodes(ids: $ids) { ... on Event { at } } }',
      variableValues: { ids: dates.map((id) => encodeGlobalID('Event', id)) },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(batches).toEqual([dates.map((date) => new Date(date))]);
    expect(result.data).toEqual({ nodes: [{ at: dates[0] }, { at: dates[1] }] });
  });

  it('does not cache results from loaders that opt out of the request cache', async () => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const batches: unknown[][] = [];

    const User = builder.objectRef<{ id: string }>('User');

    builder.node(User, {
      isTypeOf: () => true,
      id: { resolve: (user) => user.id },
      loadManyWithoutCache: (ids) => {
        batches.push([...ids]);

        return ids.map((id) => ({ id: id as string }));
      },
      fields: (t) => ({
        key: t.exposeString('id'),
        again: t.node({ id: (user) => encodeGlobalID('User', user.id) }),
      }),
    });

    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: `query($id: ID!) {
        node(id: $id) { ... on User { key again { ... on User { key } } } }
      }`,
      variableValues: { id: encodeGlobalID('User', '1') },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { key: '1', again: { key: '1' } } });
    expect(batches).toEqual([['1'], ['1']]);
  });

  it.each([
    false,
    true,
  ])('keeps copied parsed IDs separate from raw IDs (reverse: %s)', async (reverse) => {
    const calls: string[] = [];
    const builder = new SchemaBuilder<{}>({
      plugins: [RelayPlugin],
      relay: {
        nodeQueryOptions: {
          resolve: async (_parent, args, context, info): Promise<unknown> =>
            (await resolveNodes(builder, context, info, [{ ...args.id }]))[0],
        },
      },
    });
    const User = builder.objectRef<{ key: string }>('User');

    builder.node(User, {
      isTypeOf: () => true,
      id: { resolve: (user) => user.key, parse: (id) => `${id}x` },
      loadOne: (key) => {
        calls.push(key);

        return { key };
      },
      fields: (t) => ({ key: t.exposeString('key') }),
    });
    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: `query($a: ID!, $b: ID!) {
        ${reverse ? 'b: nodes(ids: [$b]) { ... on User { key } }' : ''}
        a: node(id: $a) { ... on User { key } }
        ${reverse ? '' : 'b: nodes(ids: [$b]) { ... on User { key } }'}
      }`,
      variableValues: { a: encodeGlobalID('User', 'a'), b: encodeGlobalID('User', 'ax') },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ a: { key: 'ax' }, b: [{ key: 'axx' }] });
    expect(calls).toEqual(reverse ? ['axx', 'ax'] : ['ax', 'axx']);
  });

  it('loads copied decoded IDs without stringifying opaque parsed IDs', async () => {
    const calls: unknown[] = [];
    const builder = new SchemaBuilder<{}>({
      plugins: [RelayPlugin],
      relay: {
        nodeQueryOptions: {
          resolve: async (_parent, args, context, info): Promise<unknown> =>
            (await resolveNodes(builder, context, info, [{ ...args.id }]))[0],
        },
      },
    });
    const User = builder.objectRef<{ id: number }>('User');

    builder.node(User, {
      isTypeOf: () => true,
      id: {
        resolve: (user) => user.id,
        parse: (id) => ({
          key: Number(id),
          toString() {
            throw new Error('Parsed IDs must not be stringified');
          },
        }),
      },
      loadOne: (id) => {
        calls.push(id.key);

        return { id: id.key };
      },
      fields: (t) => ({ key: t.exposeInt('id') }),
    });
    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: 'query($id: ID!) { node(id: $id) { ... on User { key } } }',
      variableValues: { id: encodeGlobalID('User', '7') },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { key: 7 } });
    expect(calls).toEqual([7]);
  });

  describe('the raw id used for caching stays out of user-facing args', () => {
    it('is absent from a globalID arg', async () => {
      const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

      let seen: object | undefined;

      const User = builder.objectRef<{ id: number }>('User');

      const UserNode = builder.node(User, {
        isTypeOf: () => true,
        id: { resolve: (user) => user.id, parse: (id) => ({ key: Number(id) }) },
        loadOne: (id) => ({ id: id.key }),
        fields: (t) => ({ key: t.int({ resolve: (user) => user.id }) }),
      });

      builder.queryType({
        fields: (t) => ({
          check: t.string({
            args: { id: t.arg.globalID({ for: UserNode, required: true }) },
            resolve: (_parent, args) => {
              seen = args.id;

              return 'ok';
            },
          }),
        }),
      });

      const result = await graphql({
        schema: builder.toSchema(),
        source: 'query($id: ID!) { check(id: $id) }',
        variableValues: { id: encodeGlobalID('User', '7') },
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(Object.keys(seen!).sort()).toEqual(['id', 'typename']);
      expect(seen).toEqual({ typename: 'User', id: { key: 7 } });
    });

    it('is absent from the args passed to a custom node query resolver', async () => {
      let seen: object | undefined;

      const builder = new SchemaBuilder<{}>({
        plugins: [RelayPlugin],
        relay: {
          nodeQueryOptions: {
            resolve: (_parent, args, _context, _info, resolveNode) => {
              seen = args.id;

              return resolveNode(args.id);
            },
          },
        },
      });

      const User = builder.objectRef<{ id: number }>('User');

      builder.node(User, {
        isTypeOf: () => true,
        id: { resolve: (user) => user.id, parse: (id) => ({ key: Number(id) }) },
        loadOne: (id) => ({ id: id.key }),
        fields: (t) => ({ key: t.int({ resolve: (user) => user.id }) }),
      });

      builder.queryType({});

      const result = await graphql({
        schema: builder.toSchema(),
        source: 'query($id: ID!) { node(id: $id) { ... on User { key } } }',
        variableValues: { id: encodeGlobalID('User', '7') },
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(Object.keys(seen!).sort()).toEqual(['id', 'typename']);
      expect(seen).toEqual({ typename: 'User', id: { key: 7 } });
      expect(result.data).toEqual({ node: { key: 7 } });
    });
  });
});
