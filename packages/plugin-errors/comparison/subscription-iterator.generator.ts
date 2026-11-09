/**
 * Comparison implementation: native async generators validate iterator results
 * and await event payloads. Each read uses its own generator so independent
 * source operations can finish independently; return() bypasses their queues.
 */
export function wrapSubscriptionIterator(
  source: AsyncIterator<unknown>,
  onError: (error: unknown) => unknown,
): AsyncIterableIterator<unknown> {
  assertIteratorObject(source);
  let iterator: AsyncIterator<unknown> | undefined = source;
  let handleError: typeof onError | undefined = onError;
  let cancellationVersion = 0;
  let failed = false;
  const done = (): IteratorResult<unknown> => ({ value: undefined, done: true });

  function finish() {
    iterator = undefined;
    handleError = undefined;
  }

  async function read(method: 'next' | 'throw', args: [] | [unknown]) {
    if (!iterator) {
      if (method === 'throw') {
        throw args[0];
      }
      return done();
    }
    const inner = iterator;
    const mapError = handleError!;
    const version = cancellationVersion;
    try {
      const operation = inner[method];
      if (operation == null) {
        if (method === 'next') {
          throw new TypeError('Subscription iterator must implement next()');
        }
        throw args[0];
      }
      const result = await normalize(await Reflect.apply(operation, inner, args)).next();
      if (version !== cancellationVersion || failed) {
        return done();
      }
      if (result.done) {
        finish();
        return result.value;
      }
      return result;
    } catch (error) {
      if (version !== cancellationVersion || failed) {
        return done();
      }
      failed = true;
      finish();
      try {
        await inner.return?.();
      } catch {
        // Preserve the read error if cleanup also fails.
      }
      if (version !== cancellationVersion) {
        return done();
      }
      const value = await mapError(error);
      return version !== cancellationVersion ? done() : { value, done: false };
    }
  }

  return {
    next: (...args) => read('next', args),
    throw: (...args: [] | [unknown]) => read('throw', args),
    async return(...args) {
      cancellationVersion += 1;
      const inner = iterator;
      const mapError = handleError;
      try {
        const cleanup = inner?.return;
        if (cleanup == null) {
          finish();
          return { value: await args[0], done: true };
        }
        const result = await Reflect.apply(cleanup, inner, args);
        assertIteratorObject(result);
        if (result.done) {
          finish();
        }
        return result;
      } catch (error) {
        finish();
        if (!mapError) {
          throw error;
        }
        return { value: await mapError(error), done: false };
      }
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

// One generator step validates the result and awaits a yielded event's payload.
// Box the terminal result as the generator's return value to preserve it intact.
async function* normalize(result: IteratorResult<unknown>) {
  for await (const value of {
    [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve(result) }),
  }) {
    yield value;
  }
  return result;
}

function assertIteratorObject(value: unknown): asserts value is object {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    throw new TypeError('Iterator methods must return an object');
  }
}
