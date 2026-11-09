/**
 * Comparison variant: a synchronous generator forwards source read requests.
 * It yields source promises without awaiting them, so concurrent reads remain
 * independent and closing is never queued behind a pending read or payload.
 *
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

  type ReadArgs = [] | [unknown];
  let reads: Generator<Promise<IteratorResult<unknown>>, void, ReadArgs> | undefined;
  let dispatching = false;

  function callNext(inner: AsyncIterator<unknown>, args: ReadArgs) {
    const operation = inner.next;
    if (operation == null) {
      throw new TypeError('Subscription iterator must implement next()');
    }
    return Reflect.apply(operation, inner, args) as Promise<IteratorResult<unknown>>;
  }

  function* nextResults(
    firstArgs: ReadArgs,
  ): Generator<Promise<IteratorResult<unknown>>, void, ReadArgs> {
    // The first generator.next() argument is ignored, so receive it at creation.
    let args = firstArgs;
    while (iterator) {
      args = yield callNext(iterator, args);
    }
  }

  function finish() {
    iterator = undefined;
    handleError = undefined;
    // The dispatcher owns no cleanup. Drop it with the source so its last
    // arguments can be collected without closing the source a second time.
    reads = undefined;
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
      let result: IteratorResult<unknown>;
      if (method === 'next') {
        if (dispatching) {
          // Native generators reject synchronous reentry. Forward that request
          // directly while the dispatcher is still inside source.next().
          result = await callNext(inner, args);
        } else {
          reads ??= nextResults(args);
          let step: IteratorResult<Promise<IteratorResult<unknown>>, void>;
          dispatching = true;
          try {
            step = reads.next(args);
          } finally {
            dispatching = false;
          }
          if (step.done) {
            return done();
          }
          result = await step.value;
        }
      } else {
        const operation = inner.throw;
        if (operation == null) {
          // throw() is optional. Route its supplied error through cleanup and mapping.
          throw args[0];
        }
        result = await Reflect.apply(operation, inner, args);
      }
      assertIteratorObject(result);
      // Async generators await yielded values, including promises from pubsub.
      const completed = Boolean(result.done);
      const value = completed ? undefined : await result.value;
      if (version !== cancellationVersion || failed) {
        return done();
      }
      if (completed) {
        finish();
      }
      return completed ? result : { value, done: false };
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
