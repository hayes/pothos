/**
 * Forward subscription cleanup immediately, even while next() is pending.
 * The source owns settling its pending reads when closed. A source failure is
 * mapped to one final event, after releasing the source's resources.
 */
export function wrapSubscriptionIterator(
  source: AsyncIterator<unknown>,
  onError: (error: unknown) => unknown,
): AsyncIterableIterator<unknown> {
  let iterator: AsyncIterator<unknown> | undefined = source;
  let handleError: typeof onError | undefined = onError;
  let cancelled = false;
  let failed = false;
  const done = (): IteratorResult<unknown> => ({ value: undefined, done: true });

  async function read(method: 'next' | 'throw', args: [] | [unknown]) {
    if (!iterator) {
      if (method === 'throw') {
        throw args[0];
      }
      return done();
    }

    const inner = iterator;
    const mapError = handleError!;
    try {
      const operation = inner[method];
      if (!operation) {
        if (method === 'next') {
          throw new TypeError('Subscription iterator must implement next()');
        }
        // throw() is optional. Route its supplied error through cleanup and mapping.
        throw args[0];
      }
      const result = await operation.apply(inner, args);
      // Async generators await yielded values, including promises from pubsub.
      const value = result.done ? undefined : await result.value;
      if (cancelled || failed) {
        return done();
      }
      if (result.done) {
        iterator = undefined;
        handleError = undefined;
      }
      return result.done ? result : { value, done: false };
    } catch (error) {
      // Claim the final error before awaiting cleanup, including concurrent reads.
      if (cancelled || failed) {
        return done();
      }
      failed = true;
      iterator = undefined;
      handleError = undefined;
      try {
        await inner.return?.();
      } catch {
        // Preserve the source error if cleanup also fails.
      }
      if (cancelled) {
        return done();
      }
      const value = await mapError(error);
      return cancelled ? done() : { value, done: false };
    }
  }

  return {
    next: (...args) => read('next', args),
    throw: (...args: [] | [unknown]) => read('throw', args),
    async return(...args) {
      cancelled = true;
      const inner = iterator;
      const mapError = handleError;
      iterator = undefined;
      handleError = undefined;
      try {
        const cleanup = inner?.return;
        return cleanup ? await cleanup.apply(inner, args) : { value: await args[0], done: true };
      } catch (error) {
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
