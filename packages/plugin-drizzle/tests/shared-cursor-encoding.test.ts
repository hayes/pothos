import { encodeCursorChunk, encodeCursorTuple } from '@pothos/core';
import { describe, expect, it } from 'vitest';
import type { PothosDrizzleSchemaConfig } from '../src/utils/config';
import { getCursorFormatter, getCursorParser } from '../src/utils/cursors';

/**
 * The anti-drift guard. The chunk encoding is written once, in `@pothos/core`; this pins this
 * plugin's cursor payload to it byte for byte, and `packages/plugin-prisma/tests/
 * shared-cursor-encoding.test.ts` pins prisma's to the same function with the same fixtures and
 * the same expected payloads. Between them the two plugins cannot encode a value differently
 * without one of these failing.
 *
 * That is the failure this is here to catch: the chunk encoder was written out twice, and a
 * truncation bug where `parseInt` read a float cursor as an integer was fixed in this plugin and
 * left standing in prisma's copy until a later pass found it.
 *
 * `EXPECTED` is duplicated verbatim in the prisma file on purpose -- a reader can see the two
 * agree, and neither copy can be edited alone without its own `encodeCursorChunk` check failing.
 */
class FakeDecimal {
  constructor(private readonly digits: string) {}

  toFixed() {
    return this.digits;
  }
}

const VALUES: Record<string, unknown> = {
  string: 'hello',
  integer: 42,
  fraction: 1.75,
  huge: 1e21,
  big: BigInt('9007199254740993'),
  date: new Date('2026-08-19T21:50:45.086Z'),
  bytes: new Uint8Array([0, 1, 2, 250, 255]),
  decimal: new FakeDecimal('0.1234567890123456789012345'),
  json: { a: 1, b: [2, 3] },
  nothing: null,
};

const EXPECTED: Record<string, string> = {
  string: 'S:hello',
  integer: 'N:42',
  fraction: 'N:1.75',
  huge: 'N:1e+21',
  big: 'I:9007199254740993',
  date: 'D:1787176245086',
  bytes: 'B:AAEC+v8=',
  decimal: 'M:0.1234567890123456789012345',
  json: 'O:{"a":1,"b":[2,3]}',
  nothing: 'Z:',
};

const names = Object.keys(VALUES);

// A cursor field may name a column or a key the row carries, so plain keys need no config.
const noColumns = {} as PothosDrizzleSchemaConfig;

function payload(fields: string[]) {
  return Buffer.from(getCursorFormatter(fields, noColumns)(VALUES), 'base64')
    .toString()
    .replace(/^DC:/, '');
}

describe('cursor payloads are the shared encoding', () => {
  it.each(names)('writes %s the way @pothos/core does', (name) => {
    expect(payload([name])).toBe(encodeCursorChunk(VALUES[name]));
    expect(payload([name])).toBe(EXPECTED[name]);
  });

  it('writes a compound cursor the way @pothos/core does', () => {
    expect(payload(names)).toBe(encodeCursorTuple(names.map((name) => VALUES[name])));
  });

  it('writes every part of a compound cursor with its own tag', () => {
    // `nothing` is a JSON null rather than a `Z:` chunk: that is what compound cursors already
    // handed out hold, and they have to keep decoding the same way.
    expect(payload(names)).toBe(
      `T:[${names.map((name) => (VALUES[name] == null ? 'null' : JSON.stringify(EXPECTED[name]))).join(',')}]`,
    );
  });

  it('reads every part back with its type', () => {
    const parsed = getCursorParser(names)(getCursorFormatter(names, noColumns)(VALUES)) as Record<
      string,
      unknown
    >;

    expect(parsed.string).toBe('hello');
    expect(parsed.integer).toBe(42);
    expect(parsed.fraction).toBe(1.75);
    expect(parsed.huge).toBe(1e21);
    expect(parsed.big).toBe(BigInt('9007199254740993'));
    expect(parsed.date).toEqual(new Date('2026-08-19T21:50:45.086Z'));
    expect([...(parsed.bytes as Uint8Array)]).toEqual([0, 1, 2, 250, 255]);
    expect(parsed.decimal).toBe('0.1234567890123456789012345');
    expect(parsed.json).toEqual({ a: 1, b: [2, 3] });
    expect(parsed.nothing).toBeNull();
  });

  // The prefix is this plugin's namespace, and changing it would invalidate every cursor rather
  // than only compound ones.
  it('keeps the DC: prefix', () => {
    expect(
      Buffer.from(getCursorFormatter(['integer'], noColumns)(VALUES), 'base64').toString(),
    ).toBe('DC:N:42');
  });
});

describe('a null cursor value', () => {
  // It used to interpolate as the string `null`, which is not a chunk: the cursor came back out
  // as "Invalid cursor" the moment a client paged from that edge.
  it('round trips on its own', () => {
    const cursor = getCursorFormatter(['nothing'], noColumns)({ nothing: null });

    expect(Buffer.from(cursor, 'base64').toString()).toBe('DC:Z:');
    expect(getCursorParser(['nothing'])(cursor)).toEqual({ nothing: null });
  });
});
