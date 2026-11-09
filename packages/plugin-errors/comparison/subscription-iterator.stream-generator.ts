/**
 * Comparison: a persistent for-await stream, with payloads boxed so unresolved
 * events cannot trap cleanup inside an async generator yield. Native generator
 * reads are serialized, ignore next arguments, and close on throw rather than
 * forwarding throw to the source.
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

  async function close(args: [unknown?]) {
    const inner = iterator;
    try {
      const cleanup = inner?.return;
      const result =
        cleanup == null
          ? { value: await args[0], done: true }
          : await Reflect.apply(cleanup, inner, args);
      assertIteratorObject(result);
      if (result.done) {
        finish();
      }
      return result;
    } catch (error) {
      finish();
      throw error;
    }
  }

  async function* values(): AsyncGenerator<
    { value: unknown },
    IteratorResult<unknown> | undefined
  > {
    let terminal: IteratorResult<unknown> | undefined;
    const iterable: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            const inner = iterator!;
            const result = await Reflect.apply(inner.next, inner, []);
            terminal = result;
            return result;
          },
          return: (...args: [] | [unknown]) => close(args),
        };
      },
    };
    for await (const value of iterable) {
      yield { value };
    }
    finish();
    return terminal;
  }

  const stream = values();
  function closeStream() {
    // Source cleanup is already running; its pending read must not hold up return.
    stream.return(undefined).catch(() => {});
  }

  async function read(method: 'next' | 'throw', args: [] | [unknown]) {
    if (!iterator) {
      if (method === 'throw') {
        throw args[0];
      }
      return done();
    }
    const mapError = handleError!;
    const version = cancellationVersion;
    try {
      const result = await Reflect.apply(stream[method], stream, args);
      const value = result.done ? undefined : await result.value.value;
      if (version !== cancellationVersion || failed) {
        return done();
      }
      return result.done ? (result.value ?? done()) : { value, done: false };
    } catch (error) {
      if (version !== cancellationVersion || failed) {
        return done();
      }
      failed = true;
      const cleanup = iterator ? close([]) : undefined;
      finish();
      closeStream();
      await cleanup?.catch(() => {});
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
      const mapError = handleError;
      try {
        const result = await close(args);
        if (!iterator) {
          closeStream();
        }
        return result;
      } catch (error) {
        closeStream();
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
