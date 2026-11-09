import { vi } from 'vitest';
import { errorTypeMap, yieldAsyncErrors } from '../src/utils';

function quietSource() {
  let settle: (result: IteratorResult<unknown>) => void = () => {};
  const source: AsyncIterableIterator<unknown> = {
    next: vi.fn(
      () =>
        new Promise<IteratorResult<unknown>>((resolve) => {
          settle = resolve;
        }),
    ),
    return: vi.fn(() => {
      const result = { value: undefined, done: true };
      settle(result);
      return Promise.resolve(result);
    }),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return source;
}

it.each([false, true])('closes an async item list promptly (read started: %s)', async (started) => {
  const source = quietSource();
  const iterator: AsyncGenerator<unknown> = yieldAsyncErrors(source, [Error]);
  const pending = started ? iterator.next() : undefined;
  const closing = iterator.return(undefined);
  try {
    expect(source.return).toHaveBeenCalledOnce();
  } finally {
    // Make a regression fail without leaving a pending iterator behind.
    await source.return!();
    await Promise.all([pending, closing]);
  }
  if (pending) {
    expect((await pending).done).toBe(true);
  }
});

it.each([
  { depth: 1, dispose: false },
  { depth: 2, dispose: false },
  { depth: 2, dispose: true },
])('closes active nested lists through depth $depth (dispose: $dispose)', async ({
  depth,
  dispose,
}) => {
  const inner = quietSource();
  const middle = quietSource();
  middle.next = vi.fn(async () => ({ value: inner, done: false }));
  const outer = quietSource();
  outer.next = vi.fn(async () => ({ value: depth === 2 ? middle : inner, done: false }));
  const iterator = yieldAsyncErrors(outer, [Error], undefined, depth);
  const pending = iterator.next();
  // Wait until the mapper has begun consuming the nested list.
  await vi.waitFor(() => expect(inner.next).toHaveBeenCalledOnce());
  const closing = dispose ? iterator[Symbol.asyncDispose]() : iterator.return(undefined);
  try {
    expect(outer.return).toHaveBeenCalledOnce();
    expect(inner.return).toHaveBeenCalledOnce();
    if (depth === 2) {
      expect(middle.return).toHaveBeenCalledOnce();
    }
  } finally {
    await inner.return!();
    await outer.return!();
    await Promise.all([pending, closing]);
  }
  expect((await pending).done).toBe(true);
});

it('preserves a supplied throw when nested cleanup also fails', async () => {
  const error = new RangeError('injected');
  const cleanupError = new RangeError('cleanup');
  const inner = quietSource();
  const closeInner = inner.return!.bind(inner);
  inner.return = async () => {
    await closeInner();
    throw cleanupError;
  };
  const outer = quietSource();
  outer.next = vi.fn(async () => ({ value: inner, done: false }));
  const iterator = yieldAsyncErrors(outer, [TypeError], undefined, 1);
  const pending = iterator.next();
  await vi.waitFor(() => expect(inner.next).toHaveBeenCalledOnce());
  await expect(iterator.throw!(error)).rejects.toBe(error);
  await pending;
});

it('preserves item errors and maps a terminal source failure only once', async () => {
  const itemError = new Error('item');
  const sourceError = new Error('source');
  const onError = vi.fn();
  async function* source() {
    yield await Promise.resolve(1);
    yield itemError;
    throw sourceError;
  }
  const iterator = yieldAsyncErrors(source(), [Error], onError);
  expect(await iterator.next()).toEqual({ value: 1, done: false });
  const item = await iterator.next();
  expect(errorTypeMap.get(item.value as object)).toBe(Error);
  const terminal = await iterator.next();
  expect(errorTypeMap.get(terminal.value as object)).toBe(Error);
  expect(onError.mock.calls).toEqual([[itemError], [sourceError]]);
  expect((await iterator.next()).done).toBe(true);
});

it('propagates unmatched nested source failures without adding an error item', async () => {
  const error = new Error('nested');
  const source = quietSource();
  source.next = () => Promise.reject(error);
  await expect(yieldAsyncErrors(source, [Error], undefined, 1).next()).rejects.toBe(error);
});

it.each([
  'throw',
  'invalid',
] as const)('maps matched source acquisition failures on first read (%s)', async (failure) => {
  const error = new Error('acquisition');
  const source: AsyncIterable<unknown> = {
    [Symbol.asyncIterator]() {
      if (failure === 'invalid') {
        return 0 as never;
      }
      throw error;
    },
  };
  const onError = vi.fn();
  const iterator = yieldAsyncErrors(source, [Error], onError);
  expect(onError).not.toHaveBeenCalled();
  const item = await iterator.next();
  expect(item.done).toBe(false);
  expect(errorTypeMap.get(item.value as object)).toBe(Error);
  expect(onError).toHaveBeenCalledExactlyOnceWith(
    failure === 'throw' ? error : expect.any(TypeError),
  );
  expect((await iterator.next()).done).toBe(true);
});

it.each([
  'throw',
  'invalid',
] as const)('rejects unmatched source acquisition failures on first read (%s)', async (failure) => {
  const error = new Error('acquisition');
  const source: AsyncIterable<unknown> = {
    [Symbol.asyncIterator]() {
      if (failure === 'invalid') {
        return 0 as never;
      }
      throw error;
    },
  };
  const iterator = yieldAsyncErrors(source, [RangeError]);
  if (failure === 'throw') {
    await expect(iterator.next()).rejects.toBe(error);
  } else {
    await expect(iterator.next()).rejects.toBeInstanceOf(TypeError);
  }
  expect((await iterator.next()).done).toBe(true);
});

it.each([
  { failure: 'read', cleanupFails: false },
  { failure: 'read', cleanupFails: true },
  { failure: 'mapping', cleanupFails: false },
  { failure: 'mapping', cleanupFails: true },
])('closes active nested lists after $failure failure (cleanup fails: $cleanupFails)', async ({
  failure,
  cleanupFails,
}) => {
  const child = quietSource();
  const error = new Error('outer failure');
  const closeChild = child.return!.bind(child);
  child.return = vi.fn(async () => {
    const result = await closeChild();
    if (cleanupFails) {
      throw new Error('child cleanup failure');
    }
    return result;
  });
  async function* source() {
    yield await Promise.resolve(child);
    if (failure === 'read') {
      throw error;
    }
    yield {
      [Symbol.iterator]() {
        throw error;
      },
    };
  }
  const iterator = yieldAsyncErrors(source(), [], undefined, 1);
  const first = iterator.next();
  await vi.waitFor(() => expect(child.next).toHaveBeenCalledOnce());
  try {
    await expect(iterator.next()).rejects.toBe(error);
    expect(child.return).toHaveBeenCalledOnce();
    expect((await first).done).toBe(true);
  } finally {
    await child.return!().catch(() => {});
    await first;
  }
});

it.each([
  'return',
  'dispose',
] as const)('ignores nested lists yielded during native generator cleanup (%s)', async (method) => {
  const child = quietSource();
  const gate = Promise.withResolvers<void>();
  async function* source() {
    try {
      yield await Promise.resolve([]);
    } finally {
      await gate.promise;
      yield child;
    }
  }
  const iterator = yieldAsyncErrors(source(), [], undefined, 1);
  await iterator.next();
  const closing =
    method === 'return' ? iterator.return(undefined) : iterator[Symbol.asyncDispose]();
  gate.resolve();
  if (method === 'return') {
    await expect(closing).resolves.toEqual({ value: undefined, done: true });
  } else {
    await closing;
  }
  expect(child.next).not.toHaveBeenCalled();
  expect(child.return).not.toHaveBeenCalled();
});

it.each([
  false,
  true,
])('requests child cleanup once without draining (source yields: %s)', async (sourceYields) => {
  const child = quietSource();
  const settleRead = child.return!.bind(child);
  child.return = vi.fn(async () => {
    await settleRead();
    return { done: false, value: 0 };
  });
  const outer = quietSource();
  outer.next = vi.fn(async () => ({ done: false, value: child }));
  if (sourceYields) {
    outer.return = vi.fn(async () => ({ done: false, value: 0 }));
  }
  const iterator = yieldAsyncErrors(outer, [], undefined, 1);
  const pending = iterator.next();
  await vi.waitFor(() => expect(child.next).toHaveBeenCalledOnce());
  await expect(iterator.return(undefined)).resolves.toEqual({ done: true, value: undefined });
  await expect(pending).resolves.toEqual({ done: true, value: undefined });
  await iterator.return(undefined);
  expect(outer.return).toHaveBeenCalledOnce();
  expect(child.return).toHaveBeenCalledOnce();
});
