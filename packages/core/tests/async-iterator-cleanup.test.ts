import { describe, expect, it, vi } from 'vitest';
import { mapAsyncIterator } from '../src/utils/map-async-iterator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('async iterator terminal cleanup', () => {
  it('claims cleanup before reentry and makes its initiating operation await it', async () => {
    const gate = deferred<void>();
    const entered = deferred<void>();
    const reentered = deferred<void>();
    const terminal = { done: true as const, value: Promise.resolve('closed') };
    let iterator: AsyncGenerator<number>;
    const close = vi.fn(async () => {
      entered.resolve();
      await iterator.return(undefined);
      reentered.resolve();
      await gate.promise;
    });
    iterator = mapAsyncIterator(
      { next: () => Promise.resolve(terminal) },
      Number,
      undefined,
      close,
    );
    let finished = false;
    const read = iterator.next();
    const completion = read.then(
      () => {
        finished = true;
      },
      () => {
        finished = true;
      },
    );
    await entered.promise;
    await reentered.promise;
    expect(finished).toBe(false);
    // Waiting for cleanup here would deadlock with its reentrant return().
    expect(await iterator.return(undefined)).toEqual({ done: true, value: undefined });
    expect(close).toHaveBeenCalledOnce();
    gate.resolve();
    expect(await read).toBe(terminal);
    await completion;
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not terminate cleanup ownership for a cancelled read after return yields', async () => {
    const pending = deferred<IteratorResult<number>>();
    const close = vi.fn(() => Promise.resolve());
    const source: AsyncIterator<number> = {
      next: vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce({ done: true, value: 'closed' }),
      return: () => Promise.resolve({ done: false, value: 2 }),
    };
    const iterator = mapAsyncIterator(source, (value) => value * 2, undefined, close);
    const oldRead = iterator.next();
    expect(await iterator.return()).toEqual({ done: false, value: 4 });
    pending.resolve({ done: false, value: 1 });
    expect(await oldRead).toEqual({ done: true, value: undefined });
    expect(close).not.toHaveBeenCalled();
    expect(await iterator.next()).toEqual({ done: true, value: 'closed' });
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    'return',
    'throw',
  ] as const)('cleans up a terminal %s without mapping its return value', async (method) => {
    const terminal = { done: true as const, value: Promise.resolve('closed') };
    const close = vi.fn(() => Promise.resolve());
    const map = vi.fn((value: number) => value * 2);
    const source: AsyncIterator<number> = {
      next: vi.fn(),
      return: () => Promise.resolve(terminal),
      throw: () => Promise.resolve(terminal),
    };
    const iterator = mapAsyncIterator(source, map, undefined, close);
    expect(await iterator[method](undefined)).toBe(terminal);
    expect(close).toHaveBeenCalledOnce();
    expect(map).not.toHaveBeenCalled();
  });

  it.each([
    'read',
    'mapping',
  ] as const)('preserves the primary %s failure when both cleanups reject', async (failure) => {
    const original = new Error('primary failure');
    const source: AsyncIterator<number> = {
      next: () =>
        failure === 'read' ? Promise.reject(original) : Promise.resolve({ done: false, value: 1 }),
      return: vi.fn(() => Promise.reject(new Error('source cleanup failure'))),
    };
    const close = vi.fn(() => Promise.reject(new Error('owned cleanup failure')));
    const iterator = mapAsyncIterator(
      source,
      (value) => {
        if (failure === 'mapping') {
          throw original;
        }
        return value;
      },
      undefined,
      close,
    );
    await expect(iterator.next()).rejects.toBe(original);
    expect(source.return).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    await iterator.return();
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    'propagate',
    'recover',
  ] as const)('keeps a return failure primary when owned cleanup rejects (%s)', async (policy) => {
    const original = new Error('return failure');
    const close = vi.fn(() => Promise.reject(new Error('owned cleanup failure')));
    const onError = policy === 'recover' ? vi.fn(() => 'handled') : undefined;
    const iterator = mapAsyncIterator(
      {
        next: vi.fn(),
        return: () => Promise.reject(original),
      },
      Number,
      onError,
      close,
    );
    if (onError) {
      expect(await iterator.return()).toEqual({ done: false, value: 'handled' });
      expect(onError).toHaveBeenCalledExactlyOnceWith(original);
    } else {
      await expect(iterator.return()).rejects.toBe(original);
    }
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    'propagate',
    'recover',
  ] as const)('suppresses a concurrent read after return fails (%s)', async (policy) => {
    const cleanup = Promise.withResolvers<IteratorResult<number>>();
    const pending = deferred<IteratorResult<number>>();
    const error = new Error('return failed');
    const map = vi.fn((value: number) => value * 2);
    const iterator = mapAsyncIterator(
      { next: () => pending.promise, return: () => cleanup.promise },
      map,
      policy === 'recover' ? () => 'handled' : undefined,
    );
    const closing = iterator.return().catch((failure: unknown) => failure);
    const read = iterator.next();
    cleanup.reject(error);
    expect(await closing).toEqual(policy === 'recover' ? { done: false, value: 'handled' } : error);
    pending.resolve({ done: false, value: 1 });
    expect(await read).toEqual({ done: true, value: undefined });
    expect(map).not.toHaveBeenCalled();
  });

  it('propagates owned cleanup failure when there is no primary source failure', async () => {
    const original = new Error('owned cleanup failure');
    const close = vi.fn(() => Promise.reject(original));
    const iterator = mapAsyncIterator(
      {
        next: () => Promise.resolve({ done: true, value: undefined }),
      },
      Number,
      undefined,
      close,
    );
    await expect(iterator.next()).rejects.toBe(original);
    expect(close).toHaveBeenCalledOnce();
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
  });
});
