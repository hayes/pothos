/**
 * Forward subscription cleanup immediately, even while next() is pending.
 * The source owns settling its pending reads when closed. A source failure is
 * mapped to one final event, after releasing the source's resources.
 */
export function wrapSubscriptionIterator(
  source: AsyncIterator<unknown>,
  onError: (error: unknown) => unknown,
): AsyncIterableIterator<unknown> {
  assertIteratorObject(source);
  let iterator: AsyncIterator<unknown> | undefined = source;
  let handleError: typeof onError | undefined = onError;
  // A source can yield during return(); old reads must stay cancelled if it resumes.
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
        // throw() is optional. Route its supplied error through cleanup and mapping.
        throw args[0];
      }
      const result = await Reflect.apply(operation, inner, args);
      assertIteratorObject(result);
      // Async generators await yielded values, including promises from pubsub.
      const value = result.done ? undefined : await result.value;
      if (version !== cancellationVersion || failed) {
        return done();
      }
      if (result.done) {
        finish();
      }
      return result.done ? result : { value, done: false };
    } catch (error) {
      // Claim the final error before awaiting cleanup, including concurrent reads.
      if (version !== cancellationVersion || failed) {
        return done();
      }
      failed = true;
      finish();
      try {
        await inner.return?.();
      } catch {
        // Preserve the source error if cleanup also fails.
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

function assertIteratorObject(value: unknown): asserts value is object {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    throw new TypeError('Iterator methods must return an object');
  }
}
