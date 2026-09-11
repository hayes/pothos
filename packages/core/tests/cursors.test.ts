import { describe, expect, it } from 'vitest';
import { decodeCursorChunk, encodeCursorChunk, encodeCursorTuple } from '../src';

// A decimal carries more digits than a `number` holds. This is the shape of the one prisma
// hands back (decimal.js), without the dependency: what the encoder needs from it is `toFixed`.
class FakeDecimal {
  constructor(private readonly digits: string) {}

  toFixed() {
    return this.digits;
  }
}

const bytes = new Uint8Array([0, 1, 2, 250, 255]);
const withMilliseconds = new Date('2026-08-19T21:50:45.086Z');

describe('cursor chunks', () => {
  // Written out rather than round-tripped so the format can't move without this test moving:
  // a cursor a client is holding has to keep decoding to the same value.
  it.each([
    ['a string', 'hello', 'S:hello'],
    ['a string holding a colon', 'a:b', 'S:a:b'],
    ['a string holding a newline', 'one\ntwo', 'S:one\ntwo'],
    ['an empty string', '', 'S:'],
    ['true', true, 'O:true'],
    ['false', false, 'O:false'],
    ['an integer', 42, 'N:42'],
    ['a negative number', -5, 'N:-5'],
    ['a fractional number', 1.75, 'N:1.75'],
    ['a number too large to write in full', 1e21, 'N:1e+21'],
    ['a bigint past Number.MAX_SAFE_INTEGER', BigInt('9007199254740993'), 'I:9007199254740993'],
    ['a date carrying milliseconds', withMilliseconds, 'D:1787176245086'],
    ['bytes', bytes, 'B:AAEC+v8='],
    ['a JSON object', { a: 1, b: [2, 3] }, 'O:{"a":1,"b":[2,3]}'],
    ['a JSON array', [1, 'two'], 'O:[1,"two"]'],
  ])('encodes %s', (_name, value, expected) => {
    expect(encodeCursorChunk(value)).toBe(expected);
  });

  it('encodes a decimal with every digit it carries', () => {
    expect(encodeCursorChunk(new FakeDecimal('0.1234567890123456789012345'))).toBe(
      'M:0.1234567890123456789012345',
    );
  });

  it.each([
    ['a string', 'hello'],
    ['a string holding a colon', 'a:b'],
    ['a string holding a newline', 'one\ntwo'],
    ['an empty string', ''],
    ['true', true],
    ['false', false],
    ['an integer', 42],
    ['a negative number', -5],
    ['a fractional number', 1.75],
    ['a number too large to write in full', 1e21],
    ['a bigint past Number.MAX_SAFE_INTEGER', BigInt('9007199254740993')],
    ['a date carrying milliseconds', withMilliseconds],
    ['a JSON object', { a: 1, b: [2, 3] }],
    ['a JSON array', [1, 'two']],
  ])('round trips %s', (_name, value) => {
    expect(decodeCursorChunk(encodeCursorChunk(value))).toEqual(value);
  });

  it('round trips bytes that are not valid UTF-8', () => {
    const decoded = decodeCursorChunk(encodeCursorChunk(bytes)) as Uint8Array;

    expect(decoded).toBeInstanceOf(Uint8Array);
    expect([...decoded]).toEqual([...bytes]);
  });

  // The class belongs to the ORM, so it comes back as the exact digits instead. Both ORMs take
  // a decimal string wherever they take a decimal, and no digit is lost on the way.
  it('round trips a high precision decimal as its exact digits', () => {
    const digits = '0.1234567890123456789012345';

    expect(decodeCursorChunk(encodeCursorChunk(new FakeDecimal(digits)))).toBe(digits);
  });

  // A cursor is an opaque position, and a nullable column is still a position. Refusing to write
  // one breaks every edge of the page rather than only a request that pages from that row.
  it('round trips a nullish value as null', () => {
    expect(encodeCursorChunk(null)).toBe('Z:');
    expect(encodeCursorChunk(undefined)).toBe('Z:');
    expect(decodeCursorChunk('Z:')).toBeNull();
  });

  it('rejects a value it cannot tag', () => {
    expect(() => encodeCursorChunk(() => {})).toThrow('Unsupported cursor type function');
    expect(() => encodeCursorChunk(Symbol('x'))).toThrow('Unsupported cursor type symbol');
  });

  it('rejects a chunk with no tag, and one with a tag it does not know', () => {
    expect(() => decodeCursorChunk('hello')).toThrow('Invalid cursor chunk: hello');
    expect(() => decodeCursorChunk('Q:1')).toThrow('Invalid cursor type Q');
  });
});

describe('compound cursor chunks', () => {
  it('tags every part', () => {
    expect(
      encodeCursorTuple([BigInt('9007199254740993'), withMilliseconds, 'x', 1.75, bytes]),
    ).toBe('T:["I:9007199254740993","D:1787176245086","S:x","N:1.75","B:AAEC+v8="]');
  });

  it('round trips every part with its type', () => {
    const values = [BigInt('9007199254740993'), withMilliseconds, 'x', 1.75, { a: 1 }];

    expect(decodeCursorChunk(encodeCursorTuple(values))).toEqual(values);
  });

  it('keeps a nullish part as null', () => {
    expect(encodeCursorTuple([null, undefined, 1])).toBe('T:[null,null,"N:1"]');
    expect(decodeCursorChunk('T:[null,null,"N:1"]')).toEqual([null, null, 1]);
  });

  it('rejects a compound chunk that does not hold an array', () => {
    expect(() => decodeCursorChunk('T:{"a":1}')).toThrow('Expected compound cursor to contain');
  });
});

describe('legacy compound chunks', () => {
  // `J:` is what a compound cursor was before each part carried a tag. Cursors in that form are
  // still out there being handed back, so they still have to decode to what they used to.
  it('reads an untagged JSON array', () => {
    expect(decodeCursorChunk('J:[1,2]')).toEqual([1, 2]);
    expect(decodeCursorChunk('J:["2","2"]')).toEqual(['2', '2']);
    expect(decodeCursorChunk('J:[1,"2026-08-19T21:50:45.086Z"]')).toEqual([
      1,
      '2026-08-19T21:50:45.086Z',
    ]);
  });

  it('is not written any more', () => {
    expect(encodeCursorTuple([1, 2])).not.toContain('J:');
  });
});
