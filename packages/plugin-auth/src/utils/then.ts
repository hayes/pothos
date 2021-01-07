import { types } from 'util';

export default class ValueOrPromise<T> {
  private valueOrPromise;

  constructor(valueOrPromise: Promise<T> | T) {
    this.valueOrPromise = valueOrPromise;
  }

  static all<T>(values: (Promise<T> | T)[]) {
    const promises: Promise<T>[] = [];

    for (const value of values) {
      if (types.isPromise(value)) {
        promises.push(value);
      }
    }
  }

  nowOrThen<U>(cb: (val: T) => Promise<U> | ValueOrPromise<U> | U) {
    if (types.isPromise(this.valueOrPromise)) {
      return (
        this.valueOrPromise
          // eslint-disable-next-line promise/no-callback-in-promise
          .then((resolved) => new ValueOrPromise(cb(resolved)))
      );
    }

    return new ValueOrPromise(cb(this.valueOrPromise));
  }

  toPromiseOrValue() {
    return this.valueOrPromise;
  }
}
