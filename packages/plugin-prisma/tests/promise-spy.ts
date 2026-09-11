/**
 * Runs `fn` while every way of creating a promise is counted: construction (`new Promise`, and
 * the statics `resolve`/`all`/... which construct through `this`) and `.then` (which derives one).
 * `fn` must be synchronous: the spies are removed before it returns.
 */
export function countPromises<T>(fn: () => T): { result: T; promises: number } {
  const NativePromise = Promise;
  const { then } = NativePromise.prototype;
  let promises = 0;

  globalThis.Promise = new Proxy(NativePromise, {
    construct(target, args, newTarget) {
      promises += 1;

      return Reflect.construct(target, args, newTarget);
    },
  });
  // biome-ignore lint/suspicious/noThenProperty: the spy counts derived promises
  NativePromise.prototype.then = function counted(this: Promise<unknown>, ...args: unknown[]) {
    promises += 1;

    return then.apply(this, args as never) as never;
  } as typeof then;

  try {
    return { result: fn(), promises };
  } finally {
    globalThis.Promise = NativePromise;
    // biome-ignore lint/suspicious/noThenProperty: restores the native method
    NativePromise.prototype.then = then;
  }
}
