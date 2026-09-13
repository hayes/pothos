import {
  decodeBase64,
  decodeBase64Bytes,
  encodeBase64,
  encodeBase64Bytes,
} from '../src/utils/base64';

const bufferDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Buffer')!;

function withoutBuffer<T>(run: () => T): T {
  Object.defineProperty(globalThis, 'Buffer', {
    configurable: true,
    enumerable: bufferDescriptor.enumerable,
    writable: true,
    value: undefined,
  });

  try {
    return run();
  } finally {
    Object.defineProperty(globalThis, 'Buffer', bufferDescriptor);
  }
}

describe('base64 helpers', () => {
  const samples = ['plain', 'Node:é', 'Node:東京', '👋 emoji', '', '﻿leading BOM', 'mid﻿BOM', '﻿'];

  it('round trips unicode with Buffer available', () => {
    for (const sample of samples) {
      expect(decodeBase64(encodeBase64(sample))).toBe(sample);
    }
  });

  it('round trips unicode without Buffer', () => {
    withoutBuffer(() => {
      for (const sample of samples) {
        expect(decodeBase64(encodeBase64(sample))).toBe(sample);
      }
    });
  });

  it('produces the same encoding with and without Buffer', () => {
    for (const sample of samples) {
      expect(withoutBuffer(() => encodeBase64(sample))).toBe(encodeBase64(sample));
    }
  });

  it('decodes Buffer-encoded values in the fallback path and vice versa', () => {
    for (const sample of samples) {
      expect(withoutBuffer(() => decodeBase64(encodeBase64(sample)))).toBe(sample);
      expect(decodeBase64(withoutBuffer(() => encodeBase64(sample)))).toBe(sample);
    }
  });

  it('round trips arbitrary bytes in both environments', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 254]);

    expect(Array.from(decodeBase64Bytes(encodeBase64Bytes(bytes)))).toEqual(Array.from(bytes));
    expect(Array.from(withoutBuffer(() => decodeBase64Bytes(encodeBase64Bytes(bytes))))).toEqual(
      Array.from(bytes),
    );
  });
});
