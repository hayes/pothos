import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { mapAsyncIterator } from '../src/utils/map-async-iterator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function iterable<T>(iterator: AsyncIterator<T>): AsyncIterableIterator<T> {
  return Object.assign(iterator, {
    [Symbol.asyncIterator]: () => iterator as AsyncIterableIterator<T>,
  });
}

describe('mapAsyncIterator', () => {
  it('includes both source or mapped values and recovered errors in its type', () => {
    const source = iterable<number>({ next: () => Promise.resolve({ done: false, value: 1 }) });
    const identity = mapAsyncIterator(
      source,
      (value) => value,
      () => 'error',
    );
    expectTypeOf(identity.next()).toEqualTypeOf<Promise<IteratorResult<number | string>>>();
    const mapped = mapAsyncIterator(source, String, () => false);
    expectTypeOf(mapped.next()).toEqualTypeOf<Promise<IteratorResult<string | boolean>>>();
    const optionalMapper = undefined as ((value: number) => string) | undefined;
    // @ts-expect-error A mapper that might be absent cannot determine the yielded type.
    mapAsyncIterator(source, optionalMapper);
  });

  it('supports async disposal through the iterator return method', async () => {
    const cleanup = vi.fn(() => Promise.resolve({ done: true, value: undefined }));
    const mapped = mapAsyncIterator(iterable({ next: vi.fn(), return: cleanup }), String);
    const close = mapped.return.bind(mapped);
    const override = vi.fn(close);
    mapped.return = override;
    await mapped[Symbol.asyncDispose]();
    expect(override).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('suppresses an error handler rejection after cancellation', async () => {
    const pending = deferred<string>();
    const started = deferred<void>();
    const source = iterable({ next: () => Promise.reject(new Error('source')) });
    const mapped = mapAsyncIterator(
      source,
      (value) => value,
      () => {
        started.resolve();
        return pending.promise;
      },
    );
    const read = mapped.next();
    await started.promise;
    await mapped.return();
    pending.reject(new Error('cancelled error handler'));
    expect(await read).toEqual({ done: true, value: undefined });
  });

  it('forwards return before the first read', async () => {
    const cleanup = vi.fn(async () => ({ done: true, value: 'closed' }));
    const source = { next: vi.fn(), return: cleanup };
    const mapped = mapAsyncIterator(source, String);
    expect(source.next).not.toHaveBeenCalled();
    expect(mapped[Symbol.asyncIterator]()).toBe(mapped);
    expect(await mapped.return!()).toEqual({ done: true, value: 'closed' });
    expect(cleanup).toHaveBeenCalledWith();
    expect(await mapped.next()).toEqual({ done: true, value: undefined });
  });

  it('forwards cleanup immediately and suppresses an older pending read', async () => {
    const pending = deferred<IteratorResult<number>>();
    const cleanup = vi.fn(async () => ({ done: true as const, value: undefined }));
    const map = vi.fn((value: number) => value * 2);
    const mapped = mapAsyncIterator(
      iterable<number>({ next: () => pending.promise, return: cleanup }),
      map,
    );
    const read = mapped.next();
    const closing = mapped.return!();
    expect(cleanup).toHaveBeenCalledOnce();
    await closing;
    pending.resolve({ done: false, value: 1 });
    expect(await read).toEqual({ done: true, value: undefined });
    expect(map).not.toHaveBeenCalled();
  });

  it('suppresses pending read rejection after cancellation', async () => {
    const pending = deferred<IteratorResult<number>>();
    const mapped = mapAsyncIterator(iterable({ next: () => pending.promise }), String);
    const read = mapped.next();
    await mapped.return!();
    pending.reject(new Error('cancelled source'));
    expect(await read).toEqual({ done: true, value: undefined });
  });

  it('suppresses a mapped value still pending when cancelled', async () => {
    const pending = deferred<string>();
    const map = vi.fn(() => pending.promise);
    const mapped = mapAsyncIterator(
      iterable({ next: async () => ({ value: 1, done: false }) }),
      map,
    );
    const read = mapped.next();
    await vi.waitFor(() => expect(map).toHaveBeenCalledOnce());
    await mapped.return!();
    pending.resolve('stale');
    expect(await read).toEqual({ done: true, value: undefined });
  });

  it('awaits source and mapped values, preserving iterator receiver and arguments', async () => {
    const source = {
      next(...args: unknown[]) {
        expect(this).toBe(source);
        expect(args).toEqual(['input']);
        return Promise.resolve({ done: false, value: Promise.resolve(3) });
      },
    };
    const mapped = mapAsyncIterator(iterable(source), async (value) => value * 2);
    expect(await mapped.next('input')).toEqual({ done: false, value: 6 });
  });

  it('preserves terminal results without mapping or awaiting their value', async () => {
    const terminal = { done: true as const, value: Promise.resolve('terminal') };
    const map = vi.fn(String);
    const mapped = mapAsyncIterator(iterable({ next: async () => terminal }), map);
    expect(await mapped.next()).toBe(terminal);
    expect(map).not.toHaveBeenCalled();
  });

  it('awaits cleanup yields consistently with its value type and preserves terminal results', async () => {
    const terminal = { done: true as const, value: Promise.resolve('closed') };
    const source: AsyncIterator<Promise<number>> = {
      next: vi.fn(),
      return: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: Promise.resolve(2) })
        .mockResolvedValueOnce(terminal),
    };
    const mapped = mapAsyncIterator(source, (value) => value);
    expectTypeOf<ReturnType<typeof mapped.return>>().toEqualTypeOf<
      Promise<IteratorResult<number>>
    >();
    expect(await mapped.return()).toEqual({ done: false, value: 2 });
    expect(await mapped.return()).toBe(terminal);
  });

  it.each([
    'next',
    'return',
  ] as const)('does not start mapping a pending cleanup yield after %s closes the source', async (method) => {
    const pending = deferred<number>();
    const offered = deferred<void>();
    const source: AsyncIterator<Promise<number>> = {
      next: () => Promise.resolve({ done: true, value: undefined }),
      return: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          get value() {
            offered.resolve();
            return pending.promise;
          },
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };
    const map = vi.fn((value: number) => value * 2);
    const mapped = mapAsyncIterator(source, map);
    const first = mapped.return();
    await offered.promise;
    await mapped[method]();
    pending.resolve(2);
    expect(await first).toEqual({ done: true, value: undefined });
    expect(map).not.toHaveBeenCalled();
  });

  it('reads done only once before inspecting value', async () => {
    let doneReads = 0;
    const mapped = mapAsyncIterator(
      iterable({
        next: async () => ({
          get done() {
            doneReads += 1;
            return doneReads > 1;
          },
          value: 2,
        }),
      }),
      (value) => value * 3,
    );
    expect(await mapped.next()).toEqual({ done: false, value: 6 });
    expect(doneReads).toBe(1);
  });

  it('keeps the source reachable when return yields and cancels older reads', async () => {
    const pending = deferred<IteratorResult<number>>();
    const source = {
      next: vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce({ done: false, value: 4 }),
      return: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: 2 })
        .mockResolvedValueOnce({ done: true, value: 'closed' }),
    };
    const mapped = mapAsyncIterator(iterable<number>(source), (value) => value * 2);
    const oldRead = mapped.next();
    expect(await mapped.return!()).toEqual({ done: false, value: 4 });
    pending.resolve({ done: false, value: 99 });
    expect(await oldRead).toEqual({ done: true, value: undefined });
    expect(await mapped.next()).toEqual({ done: false, value: 8 });
    expect(await mapped.return!()).toEqual({ done: true, value: 'closed' });
    expect(source.return).toHaveBeenCalledTimes(2);
  });

  it('forwards throw with receiver and arguments and maps its yielded value', async () => {
    const error = new Error('recover');
    const source = {
      next: vi.fn(),
      throw(...args: unknown[]) {
        expect(this).toBe(source);
        expect(args).toEqual([error]);
        return Promise.resolve({ done: false, value: 2 });
      },
    };
    expect(await mapAsyncIterator(iterable(source), (value) => value * 2).throw!(error)).toEqual({
      done: false,
      value: 4,
    });
  });

  it('finishes source cleanup if mapping a value yielded during return fails', async () => {
    const error = new Error('mapping cleanup value');
    const cleanup = vi.fn();
    async function* source() {
      try {
        yield await Promise.resolve(1);
      } finally {
        try {
          yield 2;
        } finally {
          cleanup();
        }
      }
    }
    const mapped = mapAsyncIterator(source(), (value) => {
      if (value === 2) {
        throw error;
      }
      return value;
    });
    await mapped.next();
    await expect(mapped.return!()).rejects.toBe(error);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('does not map an older cleanup yield after a later return closes the source', async () => {
    const pending = deferred<IteratorResult<number>>();
    const map = vi.fn(String);
    const source = {
      next: vi.fn(),
      return: vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce({ done: true, value: 'closed' }),
    };
    const mapped = mapAsyncIterator(iterable<number>(source), map);
    const first = mapped.return!();
    expect(await mapped.return!()).toEqual({ done: true, value: 'closed' });
    pending.resolve({ done: false, value: 1 });
    expect(await first).toEqual({ done: true, value: undefined });
    expect(map).not.toHaveBeenCalled();
  });

  it.each([
    'read',
    'mapping',
    'yielded value',
  ] as const)('releases the source on %s failure without replacing the error', async (failure) => {
    const error = new Error('original');
    const cleanup = vi.fn(() => Promise.reject(new Error('cleanup')));
    const source = {
      next: () => {
        if (failure === 'read') {
          return Promise.reject(error);
        }
        return Promise.resolve({
          done: false,
          value: failure === 'yielded value' ? Promise.reject(error) : 1,
        });
      },
      return: cleanup,
    };
    const mapped = mapAsyncIterator(iterable(source), (value) => {
      if (failure === 'mapping') {
        throw error;
      }
      return value;
    });
    await expect(mapped.next()).rejects.toBe(error);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(await mapped.next()).toEqual({ done: true, value: undefined });
  });

  it('closes and rejects a supplied throw when the source has no throw method', async () => {
    const error = new Error('injected');
    const cleanup = vi.fn(async () => ({ done: true, value: undefined }));
    const mapped = mapAsyncIterator(iterable({ next: vi.fn(), return: cleanup }), String);
    await expect(mapped.throw!(error)).rejects.toBe(error);
    expect(cleanup).toHaveBeenCalledOnce();
    await expect(mapped.throw!(error)).rejects.toBe(error);
  });

  it('passes return arguments unchanged and rejects cleanup failures unchanged', async () => {
    const error = new Error('cleanup');
    const source = {
      next: vi.fn(),
      return(...args: unknown[]): Promise<IteratorResult<never>> {
        expect(this).toBe(source);
        expect(args).toEqual(['close']);
        return Promise.reject(error);
      },
    };
    const mapped = mapAsyncIterator(iterable(source), String);
    await expect(mapped.return!('close')).rejects.toBe(error);
    expect(await mapped.next()).toEqual({ done: true, value: undefined });
  });

  it.each([
    null,
    1,
    undefined,
  ])('rejects an invalid iterator result %s and releases the source', async (result) => {
    const cleanup = vi.fn(async () => ({ done: true, value: undefined }));
    const mapped = mapAsyncIterator(
      iterable({ next: async () => result as never, return: cleanup }),
      String,
    );
    await expect(mapped.next()).rejects.toThrow('Iterator methods must return an object');
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
