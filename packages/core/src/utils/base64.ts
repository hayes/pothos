/* eslint-disable @typescript-eslint/prefer-ts-expect-error */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-restricted-globals */
/* eslint-disable @typescript-eslint/no-invalid-this */
/* eslint-disable node/no-unsupported-features/es-builtins */

const getGlobalThis = () => {
  if (typeof globalThis !== 'undefined') return globalThis;
  // @ts-ignore
  if (typeof self !== 'undefined') return self;
  // @ts-ignore
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (this !== undefined) return this!;
  throw new Error('Unable to locate global `this`');
};

export function encodeBase64(value: string): string {
  const globalThis = getGlobalThis();

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(value);
  }

  if (typeof globalThis.Buffer === 'function') {
    return globalThis.Buffer.from(value).toString('base64');
  }

  throw new Error('Unable to locate global `btoa` or `Buffer`');
}

export function decodeBase64(value: string): string {
  const globalThis = getGlobalThis();

  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(value);
  }

  if (typeof globalThis.Buffer === 'function') {
    return globalThis.Buffer.from(value, 'base64').toString();
  }

  throw new Error('Unable to locate global `atob` or `Buffer`');
}
