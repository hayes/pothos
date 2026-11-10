import { execute as toolsExecute, subscribe as toolsSubscribe } from '@graphql-tools/executor';
import {
  execute,
  experimentalExecuteIncrementally,
  type FieldNode,
  GraphQLDeferDirective,
  type GraphQLFieldConfig,
  GraphQLList,
  GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLStreamDirective,
  GraphQLString,
  Kind,
  parse,
  specifiedDirectives,
  subscribe,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  cacheKey,
  fieldKey,
  forExecution,
  forOperation,
  getLoaderMapping,
  type Mapping,
  responsePath,
  setFieldMapping,
  setLoaderMappings,
  setRowFieldMapping,
  setRowMappings,
  unionMappings,
} from '../src/loader-map.js';

type Path = GraphQLResolveInfo['path'];
function pathOf(...keys: (string | number)[]): Path {
  let path: Path | undefined;
  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }
  return path!;
}
function child(prev: Path, ...keys: (string | number)[]): Path {
  let path = prev;
  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }
  return path;
}
/**
 * The infos of one execution, as graphql-jit builds them: every resolver of the execution gets the
 * same coerced `variableValues`, and a path of its own without a `typename`.
 */
function execution(variableValues = {}) {
  return (path: Path, type = 'User') =>
    ({
      parentType: { name: type },
      path,
      variableValues,
    }) as unknown as GraphQLResolveInfo;
}

/** `keys` beneath `prev` as graphql-js 16 links them: a field's link carries its parent type. */
function linked(prev: Path | undefined, ...keys: (string | number)[]): Path {
  let path = prev;
  for (const key of keys) {
    path = { prev: path, key, typename: typeof key === 'string' ? 'Type' : undefined };
  }
  return path!;
}

const info = execution();

describe('loader map', () => {
  it('shares plan keys across list rows', () => {
    expect(responsePath(pathOf('user', 'posts', 0, 'author'))).toBe('user.posts.author');
    expect(responsePath(undefined)).toBe('');
    expect(cacheKey('Post', pathOf('user', 'posts', 3))).toBe('Post@user.posts');
  });

  it('records a plan beneath its concrete root, including connection wrappers', () => {
    const ctx = {};
    const root = pathOf('user', 'posts');
    const author: Mapping = { nested: {} };
    const comments: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), {
      'Post@nodes.author': author,
      'Post@edges.node.comments': comments,
    });
    expect(getLoaderMapping(ctx, info(child(root, 'nodes', 1, 'author')), 'Post')).toBe(author);
    expect(getLoaderMapping(ctx, info(child(root, 'edges', 0, 'node', 'comments')), 'Post')).toBe(
      comments,
    );
    expect(getLoaderMapping(ctx, info(child(root, 'nodes', 1, 'author')), 'User')).toBe(null);
    expect(getLoaderMapping({}, info(child(root, 'nodes', 1, 'author')), 'Post')).toBe(null);
  });

  it('retains different model plans contributing to one Relay nodes list', () => {
    const ctx = {};
    const root = pathOf('nodes');
    const userPosts: Mapping = { nested: {} };
    const postAuthor: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root, 'Query'), { 'User@posts': userPosts });
    setLoaderMappings(ctx, info(root, 'Query'), { 'Post@author': postAuthor });
    expect(getLoaderMapping(ctx, info(child(root, 0, 'posts')), 'User')).toBe(userPosts);
    expect(getLoaderMapping(ctx, info(child(root, 1, 'author')), 'Post')).toBe(postAuthor);
  });

  it('keeps fallback descendants isolated from planned siblings through lists and wrappers', () => {
    const ctx = {};
    const root = pathOf('users');
    const planned: Mapping = { nested: {} };
    const loaded: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'Post@posts.edges.node.author': planned });
    const fallback = child(root, 0, 'posts');
    setRowMappings(ctx, info(fallback), { 'Post@edges.node.author': loaded });
    expect(
      getLoaderMapping(ctx, info(child(fallback, 'edges', 2, 'node', 'author')), 'Post', {}),
    ).toBe(loaded);
    expect(
      getLoaderMapping(
        ctx,
        info(child(root, 1, 'posts', 'edges', 2, 'node', 'author')),
        'Post',
        {},
      ),
    ).toBe(planned);
  });

  it('does not infer loaded fields from another plan when the fallback omitted them', () => {
    const ctx = {};
    const root = pathOf('users');
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'Post@posts.author': planned });
    const fallback = child(root, 0, 'posts');
    setRowMappings(ctx, info(fallback), {});
    expect(getLoaderMapping(ctx, info(child(fallback, 0, 'author')), 'Post')).toBe(null);
    expect(getLoaderMapping(ctx, info(child(root, 1, 'posts', 0, 'author')), 'Post')).toBe(planned);
  });

  it('lets a nested query establish a new plan beneath an inherited empty scope', () => {
    const ctx = {};
    const root = pathOf('users');
    setRowMappings(ctx, info(root), {});
    const posts = child(root, 0, 'posts');
    const author: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(posts), { 'Post@author': author });
    expect(getLoaderMapping(ctx, info(child(posts, 0, 'author')), 'Post')).toBe(author);
    expect(getLoaderMapping(ctx, info(child(root, 1, 'posts', 0, 'author')), 'Post')).toBe(null);
  });

  it('records a fallback field only for its loaded parent, while its children use its scope', () => {
    const ctx = {};
    const field = pathOf('users', 0, 'posts');
    const row = {};
    const author: Mapping = { nested: {} };
    const loaded: Mapping = { nested: { 'Post@author': author } };
    setRowFieldMapping(ctx, info(field), loaded, row);
    expect(getLoaderMapping(ctx, info(field), 'User', row)).toBe(loaded);
    expect(getLoaderMapping(ctx, info(field), 'User', {})).toBe(null);
    expect(getLoaderMapping(ctx, info(child(field, 2, 'author')), 'Post', {})).toBe(author);
  });

  it('isolates aliases and occurrences even when a resolver reuses the same parent object', () => {
    const ctx = {};
    const root = pathOf('users');
    const row = {};
    const planned: Mapping = { nested: {} };
    const loaded: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'User@posts': planned, 'User@other': planned });
    const field = child(root, 0, 'posts');
    setRowFieldMapping(ctx, info(field), loaded, row);
    expect(getLoaderMapping(ctx, info(field), 'User', row)).toBe(loaded);
    expect(getLoaderMapping(ctx, info(child(root, 1, 'posts')), 'User', row)).toBe(planned);
    expect(getLoaderMapping(ctx, info(child(root, 0, 'other')), 'User', row)).toBe(planned);
  });

  it('does not retain a row override across executions reusing the context and parent', () => {
    const ctx = {};
    const row = {};
    const loaded: Mapping = { nested: {} };
    setRowFieldMapping(ctx, info(pathOf('users', 0, 'posts')), loaded, row);
    const next = execution();
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, next(pathOf('users')), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, next(pathOf('users', 0, 'posts')), 'User', row)).toBe(planned);
  });

  it('keeps the mappings of one execution from another sharing its context', () => {
    const ctx = {};
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(pathOf('users')), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, info(pathOf('users', 1, 'posts')), 'User')).toBe(planned);
    // A later operation, or the next subscription event, is another execution.
    expect(getLoaderMapping(ctx, execution()(pathOf('users', 1, 'posts')), 'User')).toBe(null);
  });

  it('tells executions apart by their abort signal getter where graphql-js 17 passes one', () => {
    // graphql-js 17 hands every event of a subscription the variables of its `subscribe`.
    const variableValues = {};
    const event = () => {
      const getAbortSignal = () => undefined;
      const payload = execution(variableValues);

      return (path: Path) => ({ ...payload(path), getAbortSignal }) as GraphQLResolveInfo;
    };
    const ctx = {};
    const first = event();
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, first(pathOf('user')), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, first(pathOf('user', 'posts')), 'User')).toBe(planned);
    expect(getLoaderMapping(ctx, event()(pathOf('user', 'posts')), 'User')).toBe(null);
  });

  it('tells executions apart by their root path link where the variables are shared', () => {
    // @graphql-tools/executor hands every event, and the `subscribe`, the same variables, but
    // builds each of them a path chain of its own.
    const info = execution({});
    const ctx = {};
    const planned: Mapping = { nested: {} };
    const subscribed = linked(undefined, 'user');
    const first = linked(undefined, 'user');

    setLoaderMappings(ctx, info(subscribed), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, info(linked(first, 'posts')), 'User')).toBe(null);
    setLoaderMappings(ctx, info(first), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, info(linked(first, 'posts')), 'User')).toBe(planned);
    expect(getLoaderMapping(ctx, info(linked(linked(undefined, 'user'), 'posts')), 'User')).toBe(
      null,
    );
  });

  it('scopes a row by its path link where the executor shares links', () => {
    const ctx = {};
    const users = linked(undefined, 'users');
    // One link per field execution, shared with the resolvers beneath it.
    const posts = [0, 1, 2].map((index) => linked(users, index, 'posts'));
    const planned: Mapping = { nested: {} };
    const own: Mapping = { nested: {} };
    const loaded: Mapping = { nested: {} };
    const row = {};
    setLoaderMappings(ctx, info(users), { 'User@posts': planned, 'Post@posts.author': planned });
    setRowFieldMapping(ctx, info(posts[0]), own, row);
    setRowMappings(ctx, info(posts[1]), { 'Post@author': loaded });
    expect(getLoaderMapping(ctx, info(posts[0]), 'User', row)).toBe(own);
    expect(getLoaderMapping(ctx, info(posts[2]), 'User', row)).toBe(planned);
    expect(getLoaderMapping(ctx, info(linked(posts[1], 0, 'author')), 'Post')).toBe(loaded);
    expect(getLoaderMapping(ctx, info(linked(posts[2], 0, 'author')), 'Post')).toBe(planned);
  });

  it('finds the mappings of an execution whose executor builds a new path for each resolver', () => {
    // graphql-jit shares no path link between resolvers, not even the root field's.
    const ctx = {};
    const planned: Mapping = { nested: {} };
    const fallback: Mapping = { nested: {} };
    const author: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(pathOf('users')), {
      'User@posts': planned,
      'Post@posts.author': author,
    });
    expect(getLoaderMapping(ctx, info(pathOf('users', 1, 'posts')), 'User')).toBe(planned);
    expect(getLoaderMapping(ctx, info(pathOf('users', 1, 'posts', 0, 'author')), 'Post')).toBe(
      author,
    );
    // A row scope applies by the field's place, list indices included, not by its path link.
    setRowMappings(ctx, info(pathOf('users', 0, 'posts')), { 'Post@author': fallback });
    expect(getLoaderMapping(ctx, info(pathOf('users', 0, 'posts', 3, 'author')), 'Post')).toBe(
      fallback,
    );
    expect(getLoaderMapping(ctx, info(pathOf('users', 1, 'posts', 3, 'author')), 'Post')).toBe(
      author,
    );
    // So does a row's own mapping.
    const row = {};
    const own: Mapping = { nested: {} };
    setRowFieldMapping(ctx, info(pathOf('users', 2, 'posts')), own, row);
    expect(getLoaderMapping(ctx, info(pathOf('users', 2, 'posts')), 'User', row)).toBe(own);
    expect(getLoaderMapping(ctx, info(pathOf('users', 3, 'posts')), 'User', row)).toBe(planned);
  });

  it('keeps a disagreeing row mapping off the siblings that agreed with the first plan', () => {
    const ctx = {};
    const root = pathOf('users');
    const planned: Mapping = { nested: {} };
    const reloaded: Mapping = { nested: {} };
    const rows = [{}, {}, {}];
    const paths = rows.map((_, i) => child(root, i, 'posts'));
    setFieldMapping(ctx, info(paths[0]), planned, rows[0]);
    setFieldMapping(ctx, info(paths[1]), reloaded, rows[1]);
    expect(getLoaderMapping(ctx, info(paths[1]), 'User', rows[1])).toBe(reloaded);
    expect(getLoaderMapping(ctx, info(paths[0]), 'User', rows[0])).toBe(planned);
    expect(getLoaderMapping(ctx, info(paths[2]), 'User', rows[2])).toBe(planned);
  });

  it('does not give agreeing rows an override of their shared field mapping', () => {
    const ctx = {};
    const root = pathOf('users');
    const planned: Mapping = { nested: {} };
    const replanned: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'User@posts': planned });
    const rows = [{}, {}, {}];
    const paths = rows.map((_, i) => child(root, i, 'posts'));
    rows.forEach((row, i) => {
      setFieldMapping(ctx, info(paths[i]), planned, row);
    });
    setLoaderMappings(ctx, info(root), { 'User@posts': replanned });
    rows.forEach((row, i) => {
      expect(getLoaderMapping(ctx, info(paths[i]), 'User', row)).toBe(replanned);
    });
  });
});

describe('forExecution', () => {
  it('gives each subscription event its own entries where the variables are shared', () => {
    const variableValues = {};
    // graphql-js 17: a getter of its own for each event.
    const event = () => {
      const getAbortSignal = () => undefined;
      const payload = execution(variableValues);

      return (path: Path) => ({ ...payload(path), getAbortSignal }) as GraphQLResolveInfo;
    };
    const cache = new WeakMap<object, Map<string, number>>();
    const first = event();
    const second = event();

    expect(forExecution(cache, first(pathOf('user')))).toBe(
      forExecution(cache, first(pathOf('user', 'posts'))),
    );
    expect(forExecution(cache, second(pathOf('user')))).not.toBe(
      forExecution(cache, first(pathOf('user'))),
    );
    expect(forOperation(cache, second(pathOf('user')))).toBe(
      forOperation(cache, first(pathOf('user'))),
    );
  });

  it('tells events apart by their root path link where an executor passes no signal', () => {
    // @graphql-tools/executor and graphql-js 16: a path chain of its own for each event.
    const info = execution({});
    const cache = new WeakMap<object, Map<string, number>>();
    const first = linked(undefined, 'user');

    expect(forExecution(cache, info(linked(first, 'posts')))).toBe(
      forExecution(cache, info(first)),
    );
    expect(forExecution(cache, info(linked(undefined, 'user')))).not.toBe(
      forExecution(cache, info(first)),
    );
  });
});

describe('fieldKey', () => {
  const [a, b, c] = ['a', 'b', 'c'].map(
    (value): FieldNode => ({ kind: Kind.FIELD, name: { kind: Kind.NAME, value } }),
  );
  const infoOf = (fieldNodes: FieldNode[], path = pathOf('items', 0, 'user')) =>
    ({ fieldNodes, path }) as unknown as GraphQLResolveInfo;

  it('keys a field on its type and every node graphql merged for it', () => {
    expect(fieldKey('User', infoOf([a, b]))).toBe(fieldKey('User', infoOf([a, b])));
    expect(fieldKey('User', infoOf([a, b]))).not.toBe(fieldKey('User', infoOf([a, c])));
    expect(fieldKey('User', infoOf([a, b]))).not.toBe(fieldKey('User', infoOf([a])));
    expect(fieldKey('User', infoOf([a]))).not.toBe(fieldKey('Post', infoOf([a])));
  });

  it('gives the same nodes the same key at any path beneath one root field', () => {
    const root = pathOf('group');

    expect(fieldKey('User', infoOf([a], child(root, 'alice', 'user')))).toBe(
      fieldKey('User', infoOf([a], child(root, 'bob', 0, 'user'))),
    );
    expect(fieldKey('User', infoOf([a], pathOf('group', 'alice', 'user')))).toBe(
      fieldKey('User', infoOf([a], pathOf('group', 'bob', 0, 'user'))),
    );
  });

  it('gives the same nodes beneath different root fields different keys', () => {
    expect(fieldKey('User', infoOf([a], pathOf('a', 'user')))).not.toBe(
      fieldKey('User', infoOf([a], pathOf('b', 'user'))),
    );
    expect(fieldKey('User', infoOf([a], pathOf('a')))).not.toBe(
      fieldKey('User', infoOf([a], pathOf('b'))),
    );
  });
});

describe('unionMappings', () => {
  /** A mapping `depth` levels deep with two keys per level, both holding the level below. */
  function sharedMapping(depth: number): Mapping {
    let mapping: Mapping = { nested: {} };

    for (let level = 0; level < depth; level += 1) {
      mapping = { nested: { 'A@x': mapping, 'B@x': mapping } };
    }

    return mapping;
  }

  it('returns a mapping unioned with itself as it is', () => {
    const mapping = sharedMapping(40);

    expect(unionMappings(mapping, mapping)).toBe(mapping);
  });

  it('visits a pair of mappings once however many keys share it', () => {
    const union = unionMappings(sharedMapping(40), sharedMapping(40));

    let at = union;

    for (let level = 0; level < 40; level += 1) {
      expect(at.nested['A@x']).toBe(at.nested['B@x']);
      at = at.nested['A@x'];
    }

    expect(at.nested).toEqual({});
  });
});

/**
 * A field `loadedBy` beneath `user`, telling whether the plan its execution recorded for `user`
 * was found. `user` records one when its parent says `planned`; `rawUser` never does. Each
 * subscription field's `subscribe` records a plan, as a snapshot loaded there would, and then
 * yields its events. graphql-js runs a schema with @defer or @stream only incrementally.
 */
function loaderMapSchema(incremental = false) {
  const planned: Mapping = { nested: {} };
  const record = (ctx: object, info: GraphQLResolveInfo) =>
    setLoaderMappings(ctx, info, { 'User@loadedBy': planned });
  const User = new GraphQLObjectType({
    name: 'User',
    fields: {
      loadedBy: {
        type: GraphQLString,
        resolve: (_row, _args, ctx: object, info) =>
          getLoaderMapping(ctx, info, 'User') ? 'plan' : 'reload',
      },
    },
  });
  const user = {
    type: User,
    resolve: (payload: unknown, _args: unknown, ctx: object, info: GraphQLResolveInfo) => {
      if ((payload as { planned?: boolean }).planned) {
        record(ctx, info);
      }

      return {};
    },
  };
  const subscription = (
    events: (root: unknown) => AsyncGenerator<unknown>,
  ): GraphQLFieldConfig<unknown, object> => ({
    ...user,
    subscribe: (root, _args, ctx, info) => {
      record(ctx, info);

      return events(root);
    },
  });

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        user,
        rawUser: { type: User, resolve: () => ({}) },
        users: {
          type: new GraphQLList(User),
          resolve: (_root, _args, ctx: object, info) => {
            setLoaderMappings(ctx, info, { 'User@loadedBy': planned });

            return [{}, {}];
          },
        },
      },
    }),
    subscription: new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        user: subscription(async function* () {
          yield await Promise.resolve({ planned: true });
          yield { planned: false };
        }),
        // One payload object published twice: planned the first time, loaded elsewhere the
        // second.
        republished: subscription(async function* () {
          const payload = { planned: true };

          yield await Promise.resolve(payload);
          payload.planned = false;
          yield payload;
        }),
        // Yields the root value its `subscribe` was handed, and whose plan it recorded.
        yieldsRoot: subscription(async function* (root) {
          yield await Promise.resolve(root);
        }),
      },
    }),
    directives: incremental
      ? [...specifiedDirectives, GraphQLDeferDirective, GraphQLStreamDirective]
      : specifiedDirectives,
  });
}

describe('loader mappings through an executor', () => {
  const schema = loaderMapSchema();

  type Subscribe = (args: {
    schema: GraphQLSchema;
    document: ReturnType<typeof parse>;
    contextValue: object;
    rootValue?: unknown;
  }) => unknown;

  describe.each([
    ['graphql-js', subscribe as Subscribe],
    ['@graphql-tools/executor', toolsSubscribe as Subscribe],
  ])('subscription events through %s', (_, subscribeWith) => {
    async function events(field: string) {
      const stream = (await subscribeWith({
        schema,
        document: parse(`subscription { ${field} { loadedBy } }`),
        contextValue: {},
        rootValue: { planned: false },
      })) as AsyncIterable<unknown>;
      const seen: unknown[] = [];

      for await (const event of stream) {
        seen.push((event as { data: Record<string, unknown> }).data[field]);
      }

      return seen;
    }

    it('finds only the plan each event recorded itself', async () => {
      expect(await events('user')).toEqual([{ loadedBy: 'plan' }, { loadedBy: 'reload' }]);
    });

    it('keeps apart two events publishing the same payload object', async () => {
      expect(await events('republished')).toEqual([{ loadedBy: 'plan' }, { loadedBy: 'reload' }]);
    });

    it("keeps an event yielding the root value apart from its subscribe's plan", async () => {
      expect(await events('yieldsRoot')).toEqual([{ loadedBy: 'reload' }]);
    });
  });

  it.each([
    ['graphql-js', execute],
    ['@graphql-tools/executor', toolsExecute],
  ])("finds each root field's plan through %s", async (_, executeWith) => {
    const result = await executeWith({
      schema,
      document: parse('{ user { loadedBy } rawUser { loadedBy } again: user { loadedBy } }'),
      rootValue: { planned: true },
      contextValue: {},
    });

    expect(result).toEqual({
      data: {
        user: { loadedBy: 'plan' },
        rawUser: { loadedBy: 'reload' },
        again: { loadedBy: 'plan' },
      },
    });
  });

  it.each([
    ['graphql-js', experimentalExecuteIncrementally as typeof toolsExecute],
    ['@graphql-tools/executor', toolsExecute],
  ])("finds a query's plan beneath @defer and @stream through %s", async (_, executeWith) => {
    const result = (await executeWith({
      schema: loaderMapSchema(true),
      document: parse(
        '{ user { ... @defer { loadedBy } } users @stream(initialCount: 1) { loadedBy } }',
      ),
      rootValue: { planned: true },
      contextValue: {},
    })) as { initialResult: unknown; subsequentResults: AsyncIterable<unknown> };

    const payloads: unknown[] = [];

    for await (const payload of result.subsequentResults) {
      payloads.push(payload);
    }

    expect(JSON.stringify([result.initialResult, payloads])).not.toContain('reload');
    expect(JSON.stringify(payloads).match(/"loadedBy":"plan"/g)).toHaveLength(2);
  });
});
