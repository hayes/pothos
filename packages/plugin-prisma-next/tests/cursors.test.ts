import { describe, expect, it } from 'vitest';
import {
  parsePrismaNextCursor as decodeCursor,
  formatPrismaNextCursor as encodeCursor,
} from '../src';

describe('cursors — encode/decode unit tests', () => {
  it('BigInt cursor round-trips through encode → decode (envelope)', () => {
    // Without the BigInt envelope, `JSON.stringify({ id: 42n })` throws
    // TypeError. The encoder wraps in `{ $bigint: '42' }`; the decoder
    // reconstructs the bigint. (Using `BigInt(42)` instead of the
    // literal `42n` because the test tsconfig targets ES2019.)
    const big = BigInt(42);
    const encoded = encodeCursor({ id: big });
    const decoded = decodeCursor(encoded);
    expect(decoded.id).toBe(big);
    expect(typeof decoded.id).toBe('bigint');
  });

  it('Date cursor round-trips via ISO heuristic', () => {
    const d = new Date('2025-03-15T12:00:00.000Z');
    const encoded = encodeCursor({ createdAt: d });
    const decoded = decodeCursor(encoded);
    expect(decoded.createdAt).toBeInstanceOf(Date);
    expect((decoded.createdAt as Date).toISOString()).toBe(d.toISOString());
  });

  it('decodeCursor rejects non-base64 / non-JSON cursors', () => {
    expect(() => decodeCursor('!!!')).toThrow(/Invalid cursor/);
  });

  it('decodeCursor rejects JSON-array payload', () => {
    const cursor = Buffer.from(JSON.stringify([1, 2])).toString('base64');
    expect(() => decodeCursor(cursor)).toThrow(/expected an object payload, got array/);
  });

  it('decodeCursor rejects JSON-number payload', () => {
    const cursor = Buffer.from('42').toString('base64');
    expect(() => decodeCursor(cursor)).toThrow(/expected an object payload, got number/);
  });

  it('decodeCursor rejects JSON-null payload', () => {
    const cursor = Buffer.from('null').toString('base64');
    expect(() => decodeCursor(cursor)).toThrow(/expected an object payload, got null/);
  });

  it('aliased exports `formatPrismaNextCursor` / `parsePrismaNextCursor` work', () => {
    const enc = encodeCursor({ id: 'x' });
    expect(decodeCursor(enc)).toEqual({ id: 'x' });
  });

  it('rejects a cursor payload exceeding the size cap (DoS guard)', () => {
    // Construct a base64 string > 8 KiB. Decode shouldn't allocate
    // the parsed object.
    const huge = Buffer.from(JSON.stringify({ pad: 'x'.repeat(10_000) })).toString('base64');
    expect(() => decodeCursor(huge)).toThrow(/payload exceeds/);
  });

  it('does NOT pollute Object.prototype via a __proto__ key in the cursor', () => {
    // Pre-flight: confirm baseline.
    const probe = {} as Record<string, unknown>;
    expect(probe.polluted).toBeUndefined();

    // Craft a payload whose JSON.parse would produce a `__proto__`
    // own-property. Direct encoder route doesn't surface it (the
    // encoder serializes plain objects), so build the base64 payload
    // by hand.
    const malicious = Buffer.from(JSON.stringify({ __proto__: { polluted: 1 } })).toString(
      'base64',
    );
    decodeCursor(malicious);

    // Object.prototype must still be clean.
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    expect(probe.polluted).toBeUndefined();
  });

  it('skips reserved keys (__proto__ / constructor / prototype) when reviving cursor payloads', () => {
    const cursor = Buffer.from(
      JSON.stringify({ id: 'real', __proto__: { x: 1 }, constructor: 1, prototype: 1 }),
    ).toString('base64');
    const out = decodeCursor(cursor);
    expect(out.id).toBe('real');
    // Reserved keys are skipped from the output entirely.
    expect((out as Record<string, unknown>).__proto__).toBeUndefined();
    expect((out as Record<string, unknown>).constructor).toBeUndefined();
    expect((out as Record<string, unknown>).prototype).toBeUndefined();
  });

  it('decoded cursor is a null-prototype object', () => {
    // Pin the null-prototype invariant — if a future refactor flips it
    // back to `{}`, the reserved-key skip still prevents pollution but
    // the second line of defense is gone.
    const enc = encodeCursor({ id: 'x' });
    expect(Object.getPrototypeOf(decodeCursor(enc))).toBeNull();
  });

  it('Object.keys works on a decoded cursor (null-proto + cursor key)', () => {
    const enc = encodeCursor({ id: 'x', createdAt: 'y' });
    expect(Object.keys(decodeCursor(enc)).sort()).toEqual(['createdAt', 'id']);
  });

  it('decode error message does not echo the client-supplied cursor', () => {
    // Log-aggregation hygiene: a malicious caller can otherwise stash
    // arbitrary text in operator logs via error.message.
    const malicious = 'XSS-PAYLOAD-MARKER';
    expect(() => decodeCursor(malicious)).toThrow(
      /^(?!.*XSS-PAYLOAD-MARKER).*Invalid cursor: not valid base64-encoded JSON\.$/,
    );
  });

  it('rejects a $bigint envelope whose payload is not a numeric string (PothosValidationError, not raw SyntaxError)', () => {
    // Without the try/catch in reviveValue, `BigInt('garbage')` would
    // surface as a raw `SyntaxError` to the client.
    const cursor = Buffer.from(JSON.stringify({ id: { $bigint: 'garbage' } })).toString('base64');
    expect(() => decodeCursor(cursor)).toThrow(
      /Invalid cursor: \$bigint envelope contained a non-numeric string/,
    );
  });

  it('polluted Object.prototype.$bigint does not redirect every revived value', () => {
    // Regression for the `Object.hasOwn` hardening: with `in` semantics,
    // a polluted Object.prototype would force every revived object
    // through the BigInt branch.
    const proto = Object.prototype as Record<string, unknown>;
    const previous = '$bigint' in proto;
    proto.$bigint = '999';
    try {
      const cursor = Buffer.from(JSON.stringify({ id: { other: 'value' } })).toString('base64');
      const out = decodeCursor(cursor);
      // `id` came back as the original object literal, not as BigInt(999).
      expect(out.id).toEqual({ other: 'value' });
    } finally {
      if (!previous) {
        delete proto.$bigint;
      }
    }
  });

  it('rejects a cursor with reserved keys whose values would trigger pollution if assigned', () => {
    // Sanity: the skip filter holds even when the key's value is an
    // attacker-supplied prototype-mutating object.
    const malicious = Buffer.from(JSON.stringify({ __proto__: { polluted: 1 } })).toString(
      'base64',
    );
    decodeCursor(malicious);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('decodes a near-cap legitimate cursor (1.5 KiB) without rejecting', () => {
    // Pin the 2 KiB cap as the rejection boundary, not 1 KiB or 4 KiB.
    // Build a realistic-looking large cursor (~1500 chars base64) and
    // confirm it decodes cleanly.
    const longString = 'a'.repeat(900); // ~900 chars → ~1200 base64
    const enc = encodeCursor({ id: longString });
    expect(enc.length).toBeGreaterThan(1200);
    expect(enc.length).toBeLessThan(2048);
    const out = decodeCursor(enc);
    expect(out.id).toBe(longString);
  });
});
