import { PothosValidationError } from '../errors.js';

const getGlobalThis = () => {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }

  // biome-ignore lint/style/noRestrictedGlobals: this is fine
  if (typeof self !== 'undefined') {
    // biome-ignore lint/style/noRestrictedGlobals: this is fine
    return self;
  }

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
    return encodeBase64Bytes(new TextEncoder().encode(value));
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
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(decodeBase64Bytes(value));
  }

  throw new Error('Unable to locate global `Buffer` or `atob`');
}

// `encodeBase64` runs its input through UTF-8, which mangles bytes that aren't valid UTF-8.
// A `Bytes`/`bytea` column holds arbitrary bytes, so it needs its own pair.
export function encodeBase64Bytes(bytes: Uint8Array): string {
  const localGlobalThis = getGlobalThis();

  if (typeof localGlobalThis.Buffer === 'function') {
    return localGlobalThis.Buffer.from(bytes).toString('base64');
  }

  if (typeof localGlobalThis.btoa === 'function') {
    let binary = '';

    // Not `String.fromCharCode(...bytes)`: spreading a large value overflows the argument limit.
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return localGlobalThis.btoa(binary);
  }

  throw new Error('Unable to locate global `Buffer` or `btoa`');
}

export function decodeBase64Bytes(value: string): Uint8Array {
  if (!base64Regex.test(value)) {
    throw new PothosValidationError('Invalid base64 string');
  }

  const localGlobalThis = getGlobalThis();

  if (typeof localGlobalThis.Buffer === 'function') {
    return localGlobalThis.Buffer.from(value, 'base64');
  }

  if (typeof localGlobalThis.atob === 'function') {
    const binary = localGlobalThis.atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  throw new Error('Unable to locate global `Buffer` or `atob`');
}
