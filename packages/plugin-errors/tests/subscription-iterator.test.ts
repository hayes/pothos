import { vi } from 'vitest';
import { wrapSubscriptionIterator } from '../src/subscription-iterator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('subscription iterator', () => {
  describe.each(['next', 'return', 'throw'] as const)('invalid %s methods', (method) => {
    it.each([
      false,
      0,
      '',
      { apply: () => Promise.resolve({ value: undefined, done: true }) },
    ])('rejects a present non-callable method %j', async (invalid) => {
      const source = {
        next: vi.fn(),
        return: vi.fn().mockResolvedValue({ value: undefined, done: true }),
        throw: vi.fn(),
      };
      Object.defineProperty(source, method, { value: invalid });
      const iterator = wrapSubscriptionIterator(source, (error) => {
        throw error;
      });
      await expect(iterator[method]!(new Error('caller error'))).rejects.toBeInstanceOf(TypeError);
      await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    });
  });

  describe.each(['next', 'return', 'throw'] as const)('invalid %s results', (method) => {
    it.each([
      null,
      undefined,
      false,
      0,
      1,
      '',
      'event',
    ])('reports invalid result %j as a TypeError and closes the wrapper', async (invalid) => {
      const source = {
        next: vi.fn(),
        throw: vi.fn(),
        return: vi.fn().mockResolvedValue({ value: undefined, done: true }),
      };
      source[method].mockResolvedValue(invalid);
      const iterator = wrapSubscriptionIterator(source, (error) => {
        throw error;
      });
      await expect(iterator[method]!()).rejects.toBeInstanceOf(TypeError);
      expect(source.return).toHaveBeenCalledOnce();
      await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    });
  });

  it('awaits promise-valued events as an async generator would', async () => {
    const iterator = wrapSubscriptionIterator(
      { next: () => Promise.resolve({ value: Promise.resolve(42), done: false }) },
      () => 'error',
    );
    await expect(iterator.next()).resolves.toEqual({ value: 42, done: false });
    await iterator.return!();
  });

  it('maps a rejected promise-valued event and closes the source', async () => {
    const failure = new Error('event failed');
    const source = {
      next: () => Promise.resolve({ value: Promise.reject(failure), done: false }),
      return: vi.fn(() => Promise.resolve({ value: undefined, done: true as const })),
    };
    const onError = vi.fn(() => 'handled');
    const iterator = wrapSubscriptionIterator(source, onError);
    await expect(iterator.next()).resolves.toEqual({ value: 'handled', done: false });
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(source.return).toHaveBeenCalledOnce();
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it.each([
    'resolve',
    'reject',
  ] as const)('suppresses a promise-valued event that settles with %s after cancellation', async (settle) => {
    const event = deferred<unknown>();
    const delivered = deferred<void>();
    const source = {
      next: () => {
        delivered.resolve();
        return Promise.resolve({ value: event.promise, done: false });
      },
      return: vi.fn(() => Promise.resolve({ value: undefined, done: true as const })),
    };
    const onError = vi.fn();
    const iterator = wrapSubscriptionIterator(source, onError);
    const next = iterator.next();
    await delivered.promise;
    await iterator.return!();
    event[settle](new Error('late event'));
    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(onError).not.toHaveBeenCalled();
    expect(source.return).toHaveBeenCalledOnce();
  });

  it('preserves values and terminal results without mapping them', async () => {
    async function* source() {
      yield await Promise.resolve(1);
      return 'finished';
    }
    const onError = vi.fn();
    const iterator = wrapSubscriptionIterator(source(), onError);
    expect(iterator[Symbol.asyncIterator]()).toBe(iterator);
    await expect(iterator.next()).resolves.toEqual({ value: 1, done: false });
    await expect(iterator.next()).resolves.toEqual({ value: 'finished', done: true });
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not lose concurrent values when a later read completes the source', async () => {
    const first = deferred<IteratorResult<unknown>>();
    const second = deferred<IteratorResult<unknown>>();
    const iterator = wrapSubscriptionIterator(
      { next: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) },
      () => 'error',
    );
    const a = iterator.next();
    const b = iterator.next();
    second.resolve({ value: undefined, done: true });
    await b;
    first.resolve({ value: 1, done: false });
    await expect(a).resolves.toEqual({ value: 1, done: false });
  });

  it('maps a rejected event even if a concurrent read already completed the source', async () => {
    const event = deferred<unknown>();
    const failure = new Error('event failed');
    const onError = vi.fn(() => 'handled');
    const source = {
      next: vi
        .fn()
        .mockResolvedValueOnce({ value: event.promise, done: false })
        .mockResolvedValueOnce({ value: undefined, done: true }),
      return: vi.fn(() => Promise.resolve({ value: undefined, done: true as const })),
    };
    const iterator = wrapSubscriptionIterator(source, onError);
    const first = iterator.next();
    await iterator.next();
    event.reject(failure);
    await expect(first).resolves.toEqual({ value: 'handled', done: false });
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it.each([
    'next',
    'return',
    'throw',
  ] as const)('looks up %s once and forwards arguments with the source receiver', async (method) => {
    const source: AsyncIterator<unknown> = {
      next: () => Promise.resolve({ value: undefined, done: true }),
    };
    const operation = vi.fn(function (this: unknown, value: unknown) {
      expect(this).toBe(source);
      return Promise.resolve({ value, done: true as const });
    });
    const lookup = vi.fn(() => operation);
    Object.defineProperty(source, method, { get: lookup });
    const iterator = wrapSubscriptionIterator(source, () => 'error');
    await expect(iterator[method]!(123)).resolves.toEqual({ value: 123, done: true });
    expect(lookup).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledExactlyOnceWith(123);
  });

  it('forwards throw to a source that can recover', async () => {
    const error = new Error('recover');
    async function* source() {
      try {
        yield await Promise.resolve(1);
      } catch (caught) {
        expect(caught).toBe(error);
        yield 2;
      }
    }
    const iterator = wrapSubscriptionIterator(source(), () => 'error');
    await iterator.next();
    await expect(iterator.throw!(error)).resolves.toEqual({ value: 2, done: false });
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('allows finally cleanup to finish when return yields done:false', async () => {
    let released = false;
    async function* source() {
      try {
        yield await Promise.resolve(1);
      } finally {
        yield 2;
        released = true;
      }
    }
    const iterator = wrapSubscriptionIterator(source(), (error) => {
      throw error;
    });
    await iterator.next();
    await expect(iterator.return!('finished')).resolves.toEqual({ value: 2, done: false });
    expect(released).toBe(false);
    await expect(iterator.next()).resolves.toEqual({ value: 'finished', done: true });
    expect(released).toBe(true);
  });

  it('lets concurrent returns finish a generator yielding during finally cleanup', async () => {
    const started = deferred<void>();
    const gate = deferred<void>();
    let released = false;
    async function* source() {
      try {
        yield await Promise.resolve(1);
      } finally {
        try {
          started.resolve();
          await gate.promise;
          yield 2;
        } finally {
          released = true;
        }
      }
    }
    const iterator = wrapSubscriptionIterator(source(), (error) => {
      throw error;
    });
    await iterator.next();
    const first = iterator.return!('first');
    await started.promise;
    const second = iterator.return!('second');
    gate.resolve();
    await expect(first).resolves.toEqual({ value: 2, done: false });
    await expect(second).resolves.toEqual({ value: 'second', done: true });
    expect(released).toBe(true);
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('keeps earlier reads cancelled when return allows new reads to continue', async () => {
    const pending = deferred<IteratorResult<unknown>>();
    const source = {
      next: vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce({ value: 3, done: false }),
      return: vi
        .fn()
        .mockResolvedValueOnce({ value: 2, done: false })
        .mockResolvedValueOnce({ value: 'finished', done: true }),
    };
    const iterator = wrapSubscriptionIterator(source, (error) => {
      throw error;
    });
    const oldRead = iterator.next();
    await expect(iterator.return!()).resolves.toEqual({ value: 2, done: false });
    await expect(iterator.next()).resolves.toEqual({ value: 3, done: false });
    pending.resolve({ value: 1, done: false });
    await expect(oldRead).resolves.toEqual({ value: undefined, done: true });
    await expect(iterator.return!()).resolves.toEqual({ value: 'finished', done: true });
    expect(source.return).toHaveBeenCalledTimes(2);
  });

  it('closes the source when throw is missing, then maps the original error', async () => {
    const source = {
      next: vi.fn(),
      return: vi.fn(() => Promise.reject(new Error('cleanup failed'))),
    };
    const failure = new Error('thrown');
    const onError = vi.fn(() => 'handled');
    const iterator = wrapSubscriptionIterator(source, onError);
    await expect(iterator.throw!(failure)).resolves.toEqual({ value: 'handled', done: false });
    expect(source.return).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('reports a malformed source missing next as a TypeError', async () => {
    const source = { return: vi.fn(() => Promise.resolve({ value: undefined, done: true })) };
    const onError = vi.fn((error) => {
      throw error;
    });
    const iterator = wrapSubscriptionIterator(source as unknown as AsyncIterator<unknown>, onError);
    await expect(iterator.next('input')).rejects.toBeInstanceOf(TypeError);
    expect(source.return).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(TypeError));
  });

  it('preserves an unhandled error even if source cleanup fails', async () => {
    const failure = new Error('unhandled');
    const source = {
      next: () => Promise.reject(failure),
      return: vi.fn(() => Promise.reject(new Error('cleanup failed'))),
    };
    const iterator = wrapSubscriptionIterator(source, (error) => {
      throw error;
    });
    await expect(iterator.next()).rejects.toBe(failure);
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    await iterator.return!();
    expect(source.return).toHaveBeenCalledOnce();
  });

  it('suppresses a late rejection after cancellation', async () => {
    const pending = deferred<IteratorResult<unknown>>();
    const onError = vi.fn();
    const source = {
      next: () => pending.promise,
      return: vi.fn(() => Promise.resolve({ value: undefined, done: true as const })),
    };
    const iterator = wrapSubscriptionIterator(source, onError);
    const next = iterator.next();
    await iterator.return!();
    pending.reject(new Error('late failure'));
    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(onError).not.toHaveBeenCalled();
    expect(source.return).toHaveBeenCalledOnce();
  });

  it('does not deliver a pending sibling value after a terminal error', async () => {
    const pending = deferred<IteratorResult<unknown>>();
    const failure = new Error('read failed');
    const source = {
      next: vi.fn().mockRejectedValueOnce(failure).mockReturnValueOnce(pending.promise),
      return: vi.fn(() => Promise.resolve({ value: undefined, done: true as const })),
    };
    const iterator = wrapSubscriptionIterator(source, () => 'handled');
    const first = iterator.next();
    const second = iterator.next();
    await expect(first).resolves.toEqual({ value: 'handled', done: false });
    pending.resolve({ value: 'late event', done: false });
    await expect(second).resolves.toEqual({ value: undefined, done: true });
    expect(source.return).toHaveBeenCalledOnce();
  });

  it('suppresses a terminal error if cancelled during error cleanup', async () => {
    const cleanup = deferred<IteratorResult<unknown>>();
    const started = deferred<void>();
    const onError = vi.fn();
    const iterator = wrapSubscriptionIterator(
      {
        next: () => Promise.reject(new Error('read failed')),
        return: () => {
          started.resolve();
          return cleanup.promise;
        },
      },
      onError,
    );
    const next = iterator.next();
    await started.promise;
    await iterator.return!();
    cleanup.resolve({ value: undefined, done: true });
    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(onError).not.toHaveBeenCalled();
  });

  it('supports sources without return and awaits the final return argument', async () => {
    const source = { next: vi.fn() };
    const iterator = wrapSubscriptionIterator(source, () => 'error');
    await expect(iterator.return!(Promise.resolve('finished'))).resolves.toEqual({
      value: 'finished',
      done: true,
    });
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    const failure = new Error('closed');
    await expect(iterator.throw!(failure)).rejects.toBe(failure);
    expect(source.next).not.toHaveBeenCalled();
  });

  it('does not close a naturally completed source again', async () => {
    const source = {
      next: () => Promise.resolve({ value: undefined, done: true as const }),
      return: vi.fn(),
    };
    const iterator = wrapSubscriptionIterator(source, () => 'error');
    await iterator.next();
    await iterator.return!();
    expect(source.return).not.toHaveBeenCalled();
  });

  it('maps a cleanup failure to a final error event', async () => {
    const failure = new Error('cleanup failed');
    const source = {
      next: vi.fn(),
      return: vi.fn(() => Promise.reject(failure)),
    };
    const onError = vi.fn(() => 'handled');
    const iterator = wrapSubscriptionIterator(source, onError);
    await expect(iterator.return!()).resolves.toEqual({ value: 'handled', done: false });
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    await iterator.return!();
    expect(source.return).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it('propagates unhandled cleanup errors and remains closed', async () => {
    const failure = new Error('cleanup failed');
    const iterator = wrapSubscriptionIterator(
      { next: vi.fn(), return: () => Promise.reject(failure) },
      (error) => {
        throw error;
      },
    );
    await expect(iterator.return!()).rejects.toBe(failure);
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });
});
