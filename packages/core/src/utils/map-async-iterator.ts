type MappedAsyncIterator<T> = AsyncIterableIterator<T> & AsyncGenerator<T>;

/**
 * Maps async iterator values and forwards return() without waiting for pending reads.
 * Method arguments and completed results pass through unchanged. Values yielded
 * by throw() or return() are mapped, and iteration can continue.
 *
 * onError may produce one final value. onClose runs once on completion or failure,
 * after source and callback references are cleared. The source must settle its
 * pending reads when closed.
 */
export function mapAsyncIterator<T, R, E = never>(
  source: AsyncIterator<T>,
  map: (value: Awaited<T>) => R,
  onError?: (error: unknown) => E,
  onClose?: () => void | Promise<void>,
): MappedAsyncIterator<Awaited<R> | Awaited<E>> {
  assertIteratorObject(source);
  let mapper: typeof map | undefined = map;
  let handleError = onError;
  let close = onClose;
  let iterator: AsyncIterator<T> | undefined = source;
  let failed = false;
  let cancellationVersion = 0;
  const done = (): IteratorResult<Awaited<R> | Awaited<E>> => ({ value: undefined, done: true });

  async function finish() {
    const cleanup = close;
    close = undefined;
    mapper = undefined;
    handleError = undefined;
    iterator = undefined;
    await cleanup?.();
  }

  async function read(method: 'next' | 'throw', args: [] | [unknown]) {
    if (!iterator) {
      if (method === 'throw') {
        throw args[0];
      }
      return done();
    }

    const version = cancellationVersion;
    const transform = mapper!;
    const mapError = handleError;
    const inner = iterator;
    try {
      const operation = inner[method];
      if (operation == null) {
        if (method === 'next') {
          throw new TypeError('Async iterator must implement next()');
        }
        throw args[0];
      }
      const result = await Reflect.apply(operation, inner, args);
      assertIteratorObject(result);
      const completed = Boolean(result.done);
      const value = completed ? undefined : await result.value;
      if (version !== cancellationVersion || failed) {
        return done();
      }
      if (completed) {
        await finish();
        return result as IteratorResult<Awaited<R> | Awaited<E>>;
      }
      const mapped = await transform(value as Awaited<T>);
      return version !== cancellationVersion || failed ? done() : { value: mapped, done: false };
    } catch (error) {
      if (version !== cancellationVersion || failed) {
        return done();
      }
      failed = true;
      // Start both cleanups before awaiting either; keep the original error.
      await Promise.allSettled([finish(), (async () => inner.return?.())()]);
      if (version !== cancellationVersion) {
        return done();
      }
      if (!mapError) {
        throw error;
      }
      try {
        const value = await mapError(error);
        return version !== cancellationVersion ? done() : { value, done: false };
      } catch (mappedError) {
        if (version !== cancellationVersion) {
          return done();
        }
        throw mappedError;
      }
    }
  }

  return {
    next: (...args) => read('next', args),
    throw: (...args: [] | [unknown]) => read('throw', args),
    async return(...args) {
      cancellationVersion += 1;
      const transform = mapper!;
      const mapError = handleError;
      const inner = iterator;
      let yielded = false;
      try {
        const cleanup = inner?.return;
        if (cleanup == null) {
          await finish();
          return { value: await args[0], done: true };
        }
        const result = await Reflect.apply(cleanup, inner, args);
        assertIteratorObject(result);
        if (result.done) {
          await finish();
          return result;
        }
        yielded = true;
        const value = await result.value;
        if (!iterator) {
          return done();
        }
        return { value: await transform(value), done: false };
      } catch (error) {
        if (yielded && !iterator) {
          return done();
        }
        failed = true;
        // If mapping a cleanup yield fails, close the source again.
        // Cleanup failures must not replace the original error.
        await Promise.allSettled([
          finish(),
          ...(yielded ? [(async () => inner?.return?.())()] : []),
        ]);
        if (!mapError) {
          throw error;
        }
        return { value: await mapError(error), done: false };
      }
    },
    [Symbol.asyncIterator]() {
      return this;
    },
    async [Symbol.asyncDispose]() {
      await this.return();
    },
  };
}

function assertIteratorObject(value: unknown): asserts value is object {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    throw new TypeError('Iterator methods must return an object');
  }
}
