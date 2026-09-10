import { encodeCursorChunk, encodeCursorTuple } from '@pothos/core';
import { describe, expect, it } from 'vitest';
import {
  parsePrismaNextCursor as decodeCursor,
  formatPrismaNextCursor as encodeCursor,
} from '../src';

/**
 * This plugin writes the cursor encoding `@pothos/core` defines, the same one the prisma and
 * drizzle plugins write: `base64('PNC:' + chunk)`, where a cursor over one column is that
 * column's tagged chunk and one over several is a `T:` tuple of chunks, positional in `cols`
 * order. Being unreleased, it has no older form to keep reading.
 *
 * The previous encoding was `JSON.stringify` of a column-keyed object, which needed a `$bigint`
 * envelope to hold a bigint at all and a regex over every decoded string to guess Dates back.
 */
class FakeDecimal {
  constructor(private readonly digits: string) {}

  toFixed() {
    return this.digits;
  }
}

const payload = (cursor: string) => Buffer.from(cursor, 'base64').toString();

describe('the cursor encoding', () => {
  it.each([
    ['a string', 'hello', 'S:hello'],
    ['an integer', 42, 'N:42'],
    ['a fractional number', 1.75, 'N:1.75'],
    ['a bigint', BigInt('9007199254740993'), 'I:9007199254740993'],
    ['a date carrying milliseconds', new Date('2026-08-19T21:50:45.086Z'), 'D:1787176245086'],
    ['bytes', new Uint8Array([0, 1, 2, 250, 255]), 'B:AAEC+v8='],
    ['a JSON value', { a: 1, b: [2, 3] }, 'O:{"a":1,"b":[2,3]}'],
    ['null', null, 'Z:'],
  ])('writes %s as its own tagged chunk', (_name, value, chunk) => {
    expect(payload(encodeCursor(['id'], { id: value }))).toBe(`PNC:${chunk}`);
    expect(payload(encodeCursor(['id'], { id: value }))).toBe(`PNC:${encodeCursorChunk(value)}`);
  });

  it.each([
    ['a string', 'hello'],
    ['an integer', 42],
    ['a fractional number', 1.75],
    ['a number too large to write in full', 1e21],
    ['a bigint', BigInt('9007199254740993')],
    ['a date carrying milliseconds', new Date('2026-08-19T21:50:45.086Z')],
    ['a JSON value', { a: 1, b: [2, 3] }],
    ['null', null],
  ])('round trips %s', (_name, value) => {
    expect(decodeCursor(['id'], encodeCursor(['id'], { id: value })).id).toEqual(value);
  });

  it('round trips bytes that are not valid UTF-8', () => {
    const key = new Uint8Array([0, 1, 2, 250, 255]);
    const decoded = decodeCursor(['key'], encodeCursor(['key'], { key })).key as Uint8Array;

    expect([...decoded]).toEqual([...key]);
  });

  // Comes back as its exact digits: the orm takes a decimal string wherever it takes a decimal,
  // and none of them fits in a `number`.
  it('round trips a high precision decimal', () => {
    const digits = '0.1234567890123456789012345';
    const cursor = encodeCursor(['amount'], { amount: new FakeDecimal(digits) });

    expect(payload(cursor)).toBe(`PNC:M:${digits}`);
    expect(decodeCursor(['amount'], cursor).amount).toBe(digits);
  });

  // The cursor format carries each column's type, so a string is decoded as a string rather
  // than guessed at from the shape of its text.
  it('leaves an ISO-8601 shaped string a string', () => {
    const value = '2025-03-15T12:00:00.000Z';

    expect(decodeCursor(['ref'], encodeCursor(['ref'], { ref: value })).ref).toBe(value);
  });
});

describe('compound cursors', () => {
  const cols = ['createdAt', 'id'];
  const row = { createdAt: new Date('2026-08-19T21:50:45.086Z'), id: BigInt(42) };

  it('writes a T: tuple with a tag per part', () => {
    expect(payload(encodeCursor(cols, row))).toBe('PNC:T:["D:1787176245086","I:42"]');
    expect(payload(encodeCursor(cols, row))).toBe(
      `PNC:${encodeCursorTuple(cols.map((col) => (row as Record<string, unknown>)[col]))}`,
    );
  });

  it('reads every part back with its type', () => {
    const decoded = decodeCursor(cols, encodeCursor(cols, row));

    expect(decoded.createdAt).toBeInstanceOf(Date);
    expect(decoded.createdAt).toEqual(row.createdAt);
    expect(decoded.id).toBe(BigInt(42));
  });

  it('keys the result from cols, in cols order', () => {
    expect(Object.keys(decodeCursor(cols, encodeCursor(cols, row)))).toEqual(cols);
  });

  it('keeps a null part null', () => {
    const decoded = decodeCursor(cols, encodeCursor(cols, { createdAt: null, id: BigInt(1) }));

    expect(decoded).toEqual({ createdAt: null, id: BigInt(1) });
  });
});

describe('rejecting a cursor', () => {
  it('rejects one that is not base64', () => {
    expect(() => decodeCursor(['id'], '!!!')).toThrow(/Invalid cursor/);
  });

  it('rejects one that carries another plugin prefix', () => {
    const other = Buffer.from('GPC:N:1').toString('base64');

    expect(() => decodeCursor(['id'], other)).toThrow(/not a cursor from this plugin/);
  });

  it('rejects a payload that is not a tagged chunk', () => {
    const untagged = Buffer.from('PNC:{"id":1}').toString('base64');

    expect(() => decodeCursor(['id'], untagged)).toThrow(/not a tagged cursor chunk/);
  });

  // A cursor of the wrong width would leave a column compared against `undefined`.
  it('rejects one whose width does not match cols', () => {
    const wide = encodeCursor(['a', 'b', 'c'], { a: 1, b: 2, c: 3 });

    expect(() => decodeCursor(['a', 'b'], wide)).toThrow(/expected 2 value\(s\) for a, b, got 3/);
  });

  it('rejects a single value cursor where a compound one is expected', () => {
    const single = encodeCursor(['a'], { a: 1 });

    expect(() => decodeCursor(['a', 'b'], single)).toThrow(/expected 2 value\(s\)/);
  });

  it('rejects a payload exceeding the size cap (DoS guard)', () => {
    const huge = encodeCursor(['pad'], { pad: 'x'.repeat(10_000) });

    expect(() => decodeCursor(['pad'], huge)).toThrow(/payload exceeds/);
  });

  it('decodes a near-cap legitimate cursor without rejecting', () => {
    const longString = 'a'.repeat(900);
    const cursor = encodeCursor(['id'], { id: longString });

    expect(cursor.length).toBeGreaterThan(1200);
    expect(cursor.length).toBeLessThan(2048);
    expect(decodeCursor(['id'], cursor).id).toBe(longString);
  });

  // Log-aggregation hygiene: a caller can otherwise stash arbitrary text in operator logs
  // through error.message.
  it('does not echo the client supplied cursor in the message', () => {
    expect(() => decodeCursor(['id'], 'XSS-PAYLOAD-MARKER')).toThrow(
      /^(?!.*XSS-PAYLOAD-MARKER).*Invalid cursor/,
    );
  });
});

describe('a cursor cannot reach the output as a key', () => {
  // The payload is positional and carries no keys of its own, so a `__proto__` or `constructor`
  // key has nowhere to come from: the result is keyed by `cols`, which the schema supplies. The
  // previous format was a column-keyed JSON object and had to filter those keys out by hand.
  it('leaves Object.prototype alone whatever the payload holds', () => {
    const probe = {} as Record<string, unknown>;
    const malicious = Buffer.from('PNC:O:{"__proto__":{"polluted":1}}').toString('base64');

    expect(decodeCursor(['id'], malicious).id).toBeDefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    expect(probe.polluted).toBeUndefined();
  });

  it('keys a reserved name only when cols asks for it, on a null prototype object', () => {
    const decoded = decodeCursor(['id'], encodeCursor(['id'], { id: 'x' }));

    expect(Object.getPrototypeOf(decoded)).toBeNull();
    expect(Object.keys(decoded)).toEqual(['id']);
  });
});
