import type { GraphQLResolveInfo, OperationDefinitionNode } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  cacheKey,
  getLoaderMapping,
  linkSubscriptionEvents,
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
const query = { operation: 'query' } as OperationDefinitionNode;

/**
 * The infos of one execution, as graphql-js 16 and graphql-jit build them: every resolver of the
 * execution gets the same coerced `variableValues`, and nothing else ties them together.
 */
function execution(rootValue?: unknown, operation = query) {
  const variableValues = {};

  return (path: Path, type = 'User') =>
    ({
      parentType: { name: type },
      path,
      variableValues,
      rootValue,
      operation,
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

      return (path: Path) =>
        ({ ...info(path), variableValues, getAbortSignal }) as GraphQLResolveInfo;
    };
    const ctx = {};
    const first = event();
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, first(pathOf('user')), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, first(pathOf('user', 'posts')), 'User')).toBe(planned);
    expect(getLoaderMapping(ctx, event()(pathOf('user', 'posts')), 'User')).toBe(null);
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

describe('linkSubscriptionEvents', () => {
  const subscription = { operation: 'subscription' } as OperationDefinitionNode;
  const planned: Mapping = { nested: {} };

  async function* yielding(...payloads: unknown[]) {
    yield* payloads;
  }

  async function drain(events: unknown) {
    const seen: unknown[] = [];

    for await (const payload of events as AsyncIterable<unknown>) {
      seen.push(payload);
    }

    return seen;
  }

  /** A `subscribe` that planned the root field and yielded `payloads`, drained. */
  async function subscribed(ctx: object, ...payloads: unknown[]) {
    const subscribe = execution(undefined, subscription);
    const events = linkSubscriptionEvents(ctx, subscribe(pathOf('user')), yielding(...payloads));

    // A generator's body, which plans, runs on the first `next`, after the stream was linked.
    setLoaderMappings(ctx, subscribe(pathOf('user')), { 'User@posts': planned });

    expect(await drain(events)).toEqual(payloads);
  }

  it('lets an event find what the subscribe that yielded its payload recorded', async () => {
    const ctx = {};
    const snapshot = {};
    const other = {};

    await subscribed(ctx, snapshot, other, true);

    const first = execution(snapshot, subscription);
    expect(getLoaderMapping(ctx, first(pathOf('user', 'posts')), 'User')).toBe(planned);

    // An event's own plan wins, and stays its own.
    const second = execution(other, subscription);
    const replanned: Mapping = { nested: {} };
    setLoaderMappings(ctx, second(pathOf('user')), { 'User@posts': replanned });
    expect(getLoaderMapping(ctx, second(pathOf('user', 'posts')), 'User')).toBe(replanned);
    expect(getLoaderMapping(ctx, first(pathOf('user', 'posts')), 'User')).toBe(planned);

    // A value that is not an object cannot be told from another event's, so links nothing.
    const third = execution(true, subscription);
    expect(getLoaderMapping(ctx, third(pathOf('user', 'posts')), 'User')).toBe(null);
  });

  it('links only a payload yielded after a planned query was handed out', async () => {
    const ctx = {};
    const subscribe = execution(undefined, subscription);
    const snapshot = {};
    const raw = {};
    const replanned = {};

    async function* stream() {
      setLoaderMappings(ctx, subscribe(pathOf('user')), { 'User@posts': planned });
      yield await Promise.resolve(snapshot);
      // A row from a pubsub: nothing planned it, so its resolvers load their own data.
      yield raw;
      setLoaderMappings(ctx, subscribe(pathOf('user')), { 'User@posts': planned });
      // A value that cannot be linked still uses up the plan handed out before it.
      yield true;
      yield {};
      setLoaderMappings(ctx, subscribe(pathOf('user')), { 'User@posts': planned });
      yield replanned;
    }

    await drain(linkSubscriptionEvents(ctx, subscribe(pathOf('user')), stream()));

    const posts = (payload: unknown) =>
      getLoaderMapping(ctx, execution(payload, subscription)(pathOf('user', 'posts')), 'User');

    expect(posts(snapshot)).toBe(planned);
    expect(posts(raw)).toBe(null);
    expect(posts(replanned)).toBe(planned);
  });

  it('links what a generator yields from a finally when it is returned or thrown into', async () => {
    const ctx = {};
    const subscribe = execution(undefined, subscription);

    for (const end of ['return', 'throw'] as const) {
      const last = {};

      async function* stream() {
        try {
          yield {};
        } catch {
          // Thrown into: carry on to the finally.
        } finally {
          setLoaderMappings(ctx, subscribe(pathOf('user')), { 'User@posts': planned });
          yield await Promise.resolve(last);
        }
      }

      const iterator = (
        linkSubscriptionEvents(ctx, subscribe(pathOf('user')), stream()) as AsyncIterable<unknown>
      )[Symbol.asyncIterator]();

      await iterator.next();
      expect(await iterator[end]!(undefined)).toEqual({ value: last, done: false });
      expect(
        getLoaderMapping(ctx, execution(last, subscription)(pathOf('user', 'posts')), 'User'),
      ).toBe(planned);
    }
  });

  it('links a payload yielded by two subscriptions sharing the context to neither', async () => {
    const ctx = {};
    const shared = {};

    await subscribed(ctx, shared);
    await subscribed(ctx, shared);

    const event = execution(shared, subscription);
    expect(getLoaderMapping(ctx, event(pathOf('user', 'posts')), 'User')).toBe(null);
  });

  it('links only the events of the same operation in the same context', async () => {
    const ctx = {};
    const snapshot = {};

    await subscribed(ctx, snapshot);

    // An operation whose root value happens to be the payload is not one of its events.
    expect(getLoaderMapping(ctx, execution(snapshot)(pathOf('user', 'posts')), 'User')).toBe(null);
    expect(
      getLoaderMapping({}, execution(snapshot, subscription)(pathOf('user', 'posts')), 'User'),
    ).toBe(null);
  });

  it('links a promised stream, passes on return, and leaves anything else as it is', async () => {
    const ctx = {};
    const subscribe = execution(undefined, subscription)(pathOf('user'));
    const error = new Error('not a stream');
    const snapshot = {};
    let returned = false;

    async function* stream() {
      try {
        yield await Promise.resolve(snapshot);
        yield {};
      } finally {
        returned = true;
      }
    }

    expect(linkSubscriptionEvents(ctx, subscribe, error)).toBe(error);

    const events = (await linkSubscriptionEvents(
      ctx,
      subscribe,
      Promise.resolve(stream()),
    )) as AsyncIterable<unknown>;
    const iterator = events[Symbol.asyncIterator]();

    setLoaderMappings(ctx, subscribe, { 'User@posts': planned });

    expect(await iterator.next()).toEqual({ value: snapshot, done: false });
    await iterator.return?.();
    expect(returned).toBe(true);
    expect(
      getLoaderMapping(ctx, execution(snapshot, subscription)(pathOf('user', 'posts')), 'User'),
    ).toBe(planned);
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
