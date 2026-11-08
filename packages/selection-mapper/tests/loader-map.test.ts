import { execute as toolsExecute, subscribe as toolsSubscribe } from '@graphql-tools/executor';
import {
  execute,
  experimentalExecuteIncrementally,
  GraphQLDeferDirective,
  GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLString,
  parse,
  specifiedDirectives,
  subscribe,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  cacheKey,
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
 * The infos of one execution, as graphql-js 16 and graphql-jit build them: every resolver of the
 * execution gets the same coerced `variableValues`, and nothing else ties them together. A
 * subscription event's also carry its payload as `rootValue`.
 */
function execution(
  operation: 'query' | 'subscription' = 'query',
  rootValue?: unknown,
  variableValues = {},
) {
  return (path: Path, type = 'User') =>
    ({
      operation: { operation },
      parentType: { name: type },
      path,
      rootValue,
      variableValues,
    }) as unknown as GraphQLResolveInfo;
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
      const payload = execution('subscription', {}, variableValues);

      return (path: Path) => ({ ...payload(path), getAbortSignal }) as GraphQLResolveInfo;
    };
    const ctx = {};
    const first = event();
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, first(pathOf('user')), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, first(pathOf('user', 'posts')), 'User')).toBe(planned);
    expect(getLoaderMapping(ctx, event()(pathOf('user', 'posts')), 'User')).toBe(null);
  });

  it('tells subscription events apart by their payload where the variables are shared', () => {
    // @graphql-tools/executor hands every event, and the `subscribe`, the same variables.
    const variableValues = {};
    const ctx = {};
    const planned: Mapping = { nested: {} };
    const subscribed = execution('subscription', undefined, variableValues);
    const first = execution('subscription', {}, variableValues);
    const second = execution('subscription', {}, variableValues);

    setLoaderMappings(ctx, subscribed(pathOf('user')), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, first(pathOf('user', 'posts')), 'User')).toBe(null);
    setLoaderMappings(ctx, first(pathOf('user')), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, first(pathOf('user', 'posts')), 'User')).toBe(planned);
    expect(getLoaderMapping(ctx, second(pathOf('user', 'posts')), 'User')).toBe(null);
  });

  it('records nothing for a subscription event whose payload is not an object', () => {
    const ctx = {};
    const planned: Mapping = { nested: {} };
    const event = execution('subscription', 1);

    setLoaderMappings(ctx, event(pathOf('user')), { 'User@posts': planned });
    setFieldMapping(ctx, event(pathOf('user', 'posts')), planned, {});
    expect(getLoaderMapping(ctx, event(pathOf('user', 'posts')), 'User')).toBe(null);
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
 * was found. `subscribe` records a plan before yielding, as a snapshot loaded there would, and
 * an event's `user` records one when its payload says so. graphql-js runs a schema with @defer
 * only incrementally.
 */
function loaderMapSchema(defer = false) {
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
      if (payload === true || (payload as { planned?: boolean }).planned) {
        record(ctx, info);
      }

      return {};
    },
  };

  return new GraphQLSchema({
    query: new GraphQLObjectType({ name: 'Query', fields: { user } }),
    subscription: new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        user: {
          ...user,
          subscribe: async function* (_root: unknown, _args: unknown, ctx: object, info) {
            record(ctx, info);
            yield await Promise.resolve({ planned: true });
            yield { planned: false };
            // Planned, but with no identity to record it under.
            yield true;
          },
        },
      },
    }),
    directives: defer ? [...specifiedDirectives, GraphQLDeferDirective] : specifiedDirectives,
  });
}

describe('loader mappings through an executor', () => {
  const schema = loaderMapSchema();

  type Subscribe = (args: {
    schema: GraphQLSchema;
    document: ReturnType<typeof parse>;
    contextValue: object;
  }) => unknown;

  describe.each([
    ['graphql-js', subscribe as Subscribe],
    ['@graphql-tools/executor', toolsSubscribe as Subscribe],
  ])('subscription events through %s', (_, subscribeWith) => {
    it('finds only the plan each event recorded itself', async () => {
      const events = (await subscribeWith({
        schema,
        document: parse('subscription { user { loadedBy } }'),
        contextValue: {},
      })) as AsyncIterable<unknown>;
      const seen: unknown[] = [];

      for await (const event of events) {
        seen.push(event);
      }

      expect(seen).toEqual([
        { data: { user: { loadedBy: 'plan' } } },
        { data: { user: { loadedBy: 'reload' } } },
        { data: { user: { loadedBy: 'reload' } } },
      ]);
    });
  });

  it.each([
    ['graphql-js', execute],
    ['@graphql-tools/executor', toolsExecute],
  ])("finds a query's plan through %s", async (_, executeWith) => {
    const result = await executeWith({
      schema,
      document: parse('{ user { loadedBy } }'),
      rootValue: { planned: true },
      contextValue: {},
    });

    expect(result).toEqual({ data: { user: { loadedBy: 'plan' } } });
  });

  it.each([
    ['graphql-js', experimentalExecuteIncrementally as typeof toolsExecute],
    ['@graphql-tools/executor', toolsExecute],
  ])("finds a query's plan beneath @defer through %s", async (_, executeWith) => {
    const result = (await executeWith({
      schema: loaderMapSchema(true),
      document: parse('{ user { ... @defer { loadedBy } } }'),
      rootValue: { planned: true },
      contextValue: {},
    })) as { initialResult: unknown; subsequentResults: AsyncIterable<unknown> };

    const payloads: unknown[] = [];

    for await (const payload of result.subsequentResults) {
      payloads.push(payload);
    }

    expect(JSON.stringify(payloads)).toContain('"loadedBy":"plan"');
  });
});
