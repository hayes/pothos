import { EventEmitter } from 'node:events';
import * as graphql from 'graphql';
import { vi } from 'vitest';
import { yieldAsyncErrors } from '../src/utils';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function executeStream(source: AsyncIterable<unknown>, depth: number, initialCount: number) {
  const itemType = depth ? new graphql.GraphQLList(graphql.GraphQLInt) : graphql.GraphQLInt;
  const schema = new graphql.GraphQLSchema({
    directives: [...graphql.specifiedDirectives, graphql.GraphQLStreamDirective],
    query: new graphql.GraphQLObjectType({
      name: 'Query',
      fields: {
        values: {
          type: new graphql.GraphQLList(itemType),
          resolve: () => yieldAsyncErrors(source, [], undefined, depth),
        },
      },
    }),
  });
  const result = await graphql.experimentalExecuteIncrementally({
    schema,
    document: graphql.parse(`{ values @stream(initialCount: ${initialCount}) }`),
  });
  if (!('initialResult' in result)) {
    throw new Error(`Expected incremental execution: ${JSON.stringify(result)}`);
  }
  return result;
}

function quietSource(events: EventEmitter, initial: unknown[] = []) {
  const waiting = deferred<void>();
  const pending = deferred<IteratorResult<unknown>>();
  let closed = false;
  const listener = (value: unknown) => pending.resolve({ value, done: false });
  events.on('item', listener);
  const iterator: AsyncIterableIterator<unknown> = {
    next: () => {
      if (closed) {
        return Promise.resolve({ value: undefined, done: true });
      }
      if (initial.length > 0) {
        return Promise.resolve({ value: initial.shift(), done: false });
      }
      waiting.resolve();
      return pending.promise;
    },
    return: vi.fn(() => {
      closed = true;
      events.off('item', listener);
      pending.resolve({ value: undefined, done: true });
      return Promise.resolve({ value: undefined, done: true });
    }),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return { iterator, waiting: waiting.promise };
}

// Incremental execution and @stream are available starting with GraphQL 17.
describe.skipIf(!graphql.experimentalExecuteIncrementally)('async item errors with @stream', () => {
  it.each([
    { depth: 0, initialCount: 1 },
    { depth: 1, initialCount: 1 },
    { depth: 1, initialCount: 0 },
  ])('delivers the initial result before blocked work ($depth, $initialCount)', async ({
    depth,
    initialCount,
  }) => {
    const gate = deferred<void>();
    let released = false;
    async function* row() {
      if (initialCount === 0) {
        await gate.promise;
      }
      yield 1;
      yield 2;
    }
    async function* source() {
      yield depth ? row() : 1;
      if (initialCount === 1) {
        await gate.promise;
      }
      yield depth ? [3, 4] : 2;
    }

    try {
      const result = await executeStream(source(), depth, initialCount);
      expect(released).toBe(false);
      expect(result.initialResult.errors).toBeUndefined();
      expect(result.initialResult.data).toEqual({
        values: initialCount ? (depth ? [[1, 2]] : [1]) : [],
      });
      expect(result.initialResult.hasNext).toBe(true);

      released = true;
      gate.resolve();
      const items: unknown[] = [];
      let hasNext = true;
      for await (const payload of result.subsequentResults) {
        hasNext = payload.hasNext;
        for (const patch of payload.incremental ?? []) {
          expect(patch.errors).toBeUndefined();
          if ('items' in patch) {
            items.push(...patch.items);
          }
        }
        for (const completed of payload.completed ?? []) {
          expect(completed.errors).toBeUndefined();
        }
      }
      expect(items).toEqual(
        depth
          ? initialCount
            ? [[3, 4]]
            : [
                [1, 2],
                [3, 4],
              ]
          : [2],
      );
      expect(hasNext).toBe(false);
    } finally {
      gate.resolve();
    }
  });

  it.each([
    0, 1,
  ])('closes a quiet streamed source and its active children (depth: %i)', async (depth) => {
    const events = new EventEmitter();
    const child = depth ? quietSource(events) : undefined;
    const source = quietSource(events, child ? [child.iterator] : [1]);
    const result = await executeStream(source.iterator, depth, depth ? 0 : 1);
    const pending = result.subsequentResults.next();
    await (child?.waiting ?? source.waiting);
    expect(events.listenerCount('item')).toBe(depth ? 2 : 1);

    await result.subsequentResults.return();

    await expect(pending).resolves.toMatchObject({ done: true });
    expect(events.listenerCount('item')).toBe(0);
    expect(source.iterator.return).toHaveBeenCalledOnce();
    if (child) {
      expect(child.iterator.return).toHaveBeenCalledOnce();
    }
  });
});
