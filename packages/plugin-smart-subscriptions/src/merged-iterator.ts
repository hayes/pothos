export default class MergedAsyncIterator<T> implements AsyncIterator<T>, AsyncIterable<T> {
  [Symbol.asyncIterator] = () => this;

  iterators = new Set<AsyncIterator<T>>();

  nextPending = new Map<AsyncIterator<T>, boolean>();

  pendingPulls: {
    resolve: (value: IteratorResult<T>) => void;
    reject: (error: any) => void;
  }[] = [];

  resultQueue: T[] = [];

  error: unknown;

  closeWhenExhausted: boolean;

  stopped: boolean = false;

  debounce: number;

  debounceTimer?: NodeJS.Timeout | null;

  unref: boolean;

  lastResult: number = 0;

  debounceFirst: boolean;

  constructor(
    iterators: AsyncIterator<T>[],
    options: {
      closeWhenExhausted?: boolean;
      debounce?: number | null;
      unref?: boolean;
      debounceFirst?: boolean;
    } = {},
  ) {
    this.closeWhenExhausted = options.closeWhenExhausted ?? true;
    this.debounce = options.debounce ?? 0;
    this.unref = options.unref ?? true;
    this.debounceFirst = options.debounceFirst ?? false;

    for (const iter of iterators) {
      this.add(iter);
    }
  }

  add(iter: AsyncIterator<T>) {
    if (this.iterators.has(iter)) {
      return;
    }

    this.iterators.add(iter);
  }

  getNext(iter: AsyncIterator<T>) {
    if (this.nextPending.get(iter)) {
      return;
    }

    this.nextPending.set(iter, true);

    iter.next().then(
      res => this.handleResult(res, iter),
      error => this.handleError(error),
    );
  }

  handleError(error: any) {
    this.error = error;

    for (const pull of this.pendingPulls) {
      pull.reject(this.error);
    }

    this.stop(false);
  }

  handleResult(data: IteratorResult<T>, iter: AsyncIterator<T>) {
    if (this.stopped) {
      return;
    }

    if (!this.iterators.has(iter)) {
      return;
    }

    this.nextPending.set(iter, false);

    if (data.done) {
      this.iterators.delete(iter);
    }

    this.pushValue(data.value);
  }

  pushValue(value: T) {
    this.resultQueue.push(value);
    this.processResult();
  }

  processResult() {
    if (this.resultQueue.length === 0 || this.pendingPulls.length === 0) {
      return;
    }

    if (this.debounceTimer) {
      return;
    }

    const timeSinceResult = Date.now() - this.lastResult;

    if (timeSinceResult < this.debounce) {
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.processResult();
      }, this.debounce - timeSinceResult);

      if (this.unref) {
        this.debounceTimer.unref();
      }

      return;
    }

    this.lastResult = Date.now();

    const { resolve } = this.pendingPulls.shift()!;

    // If results are debounced only process latest result
    if (this.debounce) {
      resolve({
        value: this.resultQueue.pop()!,
        done: false,
      });

      this.resultQueue.length = 0;
    } else {
      resolve({
        value: this.resultQueue.shift()!,
        done: false,
      });
    }
  }

  sendResult(data: IteratorResult<T>) {
    if (this.pendingPulls.length === 0) {
      this.resultQueue.push(data.value);
    } else {
      this.pendingPulls.shift()!.resolve({
        value: data.value,
        done: false,
      });
    }
  }

  next = () => {
    if (this.error) {
      return Promise.reject(this.error);
    }

    if (this.stopped) {
      return Promise.resolve({
        value: undefined,
        done: true as const,
      });
    }

    if (this.resultQueue.length === 0) {
      if (this.iterators.size === 0 && this.closeWhenExhausted) {
        return Promise.resolve({
          value: undefined,
          done: true as const,
        });
      }

      for (const iter of this.iterators) {
        this.getNext(iter);
      }
    }

    if (this.debounce && this.debounceFirst && !this.lastResult) {
      this.lastResult = Date.now();
    }

    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.pendingPulls.push({ resolve, reject });
      this.processResult();
    });
  };

  return = async () => {
    this.stop();

    await Promise.all([...this.iterators].map(iter => iter.return?.()));

    return {
      value: undefined,
      done: true as const,
    };
  };

  throw = async (error: any) => {
    this.stop();

    this.iterators.forEach(iter => {
      // eslint-disable-next-line no-unused-expressions
      iter.throw?.(error).catch(() => {});
    });

    return Promise.reject<IteratorResult<T>>(error);
  };

  private stop(resolvePending = true) {
    if (!this.stopped) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      this.stopped = true;
      if (resolvePending) {
        this.pendingPulls.forEach(({ resolve }) => resolve({ value: undefined, done: true }));
      }
      this.pendingPulls.length = 0;
      this.resultQueue.length = 0;
    }
  }
}
