import { MergedAsyncIterator } from '.';

export default class SubscriptionManager {
  iterator: MergedAsyncIterator<unknown>;

  activeSubscriptions = new Map<string, AsyncIterator<unknown>>();

  nextSubscriptions = new Map<string, AsyncIterator<unknown>>();

  subscribeToName: (name: string) => AsyncIterator<unknown>;

  constructor(subscribe: (name: string) => AsyncIterator<unknown>) {
    this.subscribeToName = subscribe;

    this.iterator = new MergedAsyncIterator<unknown>([], {
      closeWhenExhausted: false,
      unref: true,
      debounce: 10,
      debounceFirst: true,
    });

    // Trigger initial fetch
    this.iterator.pushValue(null);
  }

  register(name: string) {
    if (this.nextSubscriptions.has(name)) {
      return;
    }

    if (this.activeSubscriptions.has(name)) {
      this.nextSubscriptions.set(name, this.activeSubscriptions.get(name)!);

      return;
    }

    const iterator = this.subscribeToName(name);
    const firstResult = iterator.next();

    let first = true;

    const primed = {
      throw: iterator.throw?.bind(iterator),
      return: iterator.return?.bind(iterator),
      next: () => {
        if (first) {
          first = false;

          return firstResult;
        }

        return iterator.next();
      },
    };

    this.nextSubscriptions.set(name, primed);
    this.iterator.add(primed);
  }

  createIterable() {}

  [Symbol.asyncIterator](): AsyncIterator<unknown> {
    return {
      return: this.iterator.return,
      throw: this.iterator.throw,
      next: () => {
        [...this.activeSubscriptions.keys()].forEach(name => {
          if (!this.nextSubscriptions.has(name)) {
            // eslint-disable-next-line no-unused-expressions
            this.activeSubscriptions.get(name)?.return?.(null);
          }
        });

        this.activeSubscriptions = this.nextSubscriptions;
        this.nextSubscriptions = new Map();

        return this.iterator.next();
      },
    };
  }
}
