import { PothosValidationError } from '../errors';

const getGlobalThis = () => {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }

  // biome-ignore lint/style/noRestrictedGlobals: <explanation>
  if (typeof self !== 'undefined') {
    // biome-ignore lint/style/noRestrictedGlobals: <explanation>
    return self;
  }
  // @ts-ignore
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  if (this !== undefined) {
    return this!;
  }
  throw new Error('Unable to locate global `this`');
};

export function encodeBase64(value: string): string {
  const localGlobalThis = getGlobalThis();

  if (typeof localGlobalThis.Buffer === 'function') {
    return localGlobalThis.Buffer.from(value).toString('base64');
  }

  if (typeof localGlobalThis.btoa === 'function') {
    return localGlobalThis.btoa(value);
  }

  throw new Error('Unable to locate global `Buffer` or `btoa`');
}

const base64Regex = /^(?:[\d+/A-Za-z]{4})*(?:[\d+/A-Za-z]{2}==|[\d+/A-Za-z]{3}=)?$/;
export function decodeBase64(value: string): string {
  if (!base64Regex.test(value)) {
    throw new PothosValidationError('Invalid base64 string');
  }
  const localGlobalThis = getGlobalThis();

  if (typeof localGlobalThis.Buffer === 'function') {
    return localGlobalThis.Buffer.from(value, 'base64').toString();
  }

  if (typeof localGlobalThis.atob === 'function') {
    return localGlobalThis.atob(value);
  }

  throw new Error('Unable to locate global `Buffer` or `atob`');
}
