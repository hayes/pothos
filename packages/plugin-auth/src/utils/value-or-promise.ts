import { types } from 'util';

type ResolveValue<T> = T extends ValueOrPromise<infer U> ? U : T extends Promise<infer U> ? U : T;

type ResolveAll<T extends unknown[]> = {
  [K in keyof T]: ResolveValue<T>;
};

export default class ValueOrPromise<T> {
  private valueOrPromise: T | Promise<T>;

  constructor(valueOrPromise: ValueOrPromise<T> | Promise<T> | T) {
    if (valueOrPromise instanceof ValueOrPromise) {
      this.valueOrPromise = valueOrPromise.toValueOrPromise();
    } else {
      this.valueOrPromise = valueOrPromise;
    }
  }

  static resolve<T>(valueOrPromise: ValueOrPromise<T> | Promise<T> | T) {
    if (valueOrPromise instanceof ValueOrPromise) {
      return valueOrPromise;
    }

    return new ValueOrPromise(valueOrPromise);
  }

  static all<T extends unknown[]>(values: T): ValueOrPromise<ResolveAll<T>> {
    let hasPromise = false;

    const list = values.map((value) => {
      const unwrapped = ValueOrPromise.unwrap(value);

      if (types.isPromise(unwrapped)) {
        hasPromise = true;

        return (unwrapped as Promise<T>).then((result) => ValueOrPromise.unwrap(result));
      }

      return unwrapped;
    });

    return new ValueOrPromise(hasPromise ? Promise.all(list) : list) as ValueOrPromise<
      ResolveAll<T>
    >;
  }

  static unwrap<T>(value: ValueOrPromise<T> | T) {
    return value instanceof ValueOrPromise ? value.toValueOrPromise() : value;
  }

  nowOrThen<U>(cb: (val: T) => ValueOrPromise<U> | Promise<U> | U): ValueOrPromise<U> {
    if (types.isPromise(this.valueOrPromise)) {
      return new ValueOrPromise<U>(
        this.valueOrPromise.then((value) => {
          // eslint-disable-next-line promise/no-callback-in-promise
          const next = cb(value);

          return next instanceof ValueOrPromise ? next.toValueOrPromise() : next;
        }),
      );
    }

    return new ValueOrPromise(cb(this.valueOrPromise));
  }

  inject(cb: (val: T) => void | Promise<void>) {
    const currentValue = this.valueOrPromise;
    if (types.isPromise(currentValue)) {
      this.valueOrPromise = currentValue.then((value) => {
        // eslint-disable-next-line promise/no-callback-in-promise
        const next = cb(value);

        return types.isPromise(next) ? next.then(() => currentValue) : currentValue;
      });
    } else {
      const next = cb(currentValue);

      if (types.isPromise(next)) {
        this.valueOrPromise = next.then(() => currentValue);
      }
    }

    return this;
  }

  toValueOrPromise() {
    return this.valueOrPromise;
  }
}
