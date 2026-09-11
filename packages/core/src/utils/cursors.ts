import { PothosValidationError } from '../errors.js';
import { decodeBase64Bytes, encodeBase64Bytes } from './base64.js';

/**
 * The cursor payload encoding shared by the ORM plugins.
 *
 * A cursor is `base64(<plugin prefix>:<chunk>)`. The prefix (`GPC:` for prisma, `DC:` for
 * drizzle) is the plugin's namespace and is not this module's business. A chunk is what the
 * value itself encodes to: a one letter tag, a colon, and a payload.
 *
 * | tag | value               | payload                                                  |
 * | --- | ------------------- | -------------------------------------------------------- |
 * | `S` | string              | the string, verbatim                                      |
 * | `N` | number              | `String(value)`, so `1.75` and `1e+21` survive            |
 * | `I` | bigint              | the decimal digits                                        |
 * | `D` | Date                | epoch milliseconds                                        |
 * | `B` | Uint8Array / Buffer | base64 of the bytes                                       |
 * | `M` | decimal             | the exact decimal digits                                  |
 * | `O` | JSON value          | `JSON.stringify(value)`                                   |
 * | `Z` | null                | nothing                                                   |
 * | `T` | compound cursor     | a JSON array of chunk strings, `null` for a nullish part  |
 * | `J` | *legacy* compound   | a JSON array of untagged values -- decoded, never written |
 *
 * A compound cursor is `T:` because tagging each part is the only way a bigint, a Date's
 * milliseconds or a set of bytes survives being one of several values: a plain JSON array
 * turns a Date into a string and throws outright on a bigint.
 */

const CHUNK_PATTERN = /^([A-Z]):([\s\S]*)$/;

// A `Decimal` (prisma's, decimal.js) carries more digits than a `number` holds, so it is written
// out in full rather than through `Number`. Duck typed because the class belongs to the ORM.
function isDecimalLike(value: object): value is { toFixed: () => string } {
  return typeof (value as { toFixed?: unknown }).toFixed === 'function';
}

/**
 * Encodes a single cursor value as a tagged chunk.
 *
 * A nullish value is a chunk like any other. A cursor is an opaque position handed back to the
 * server, and refusing to write one for a nullable column breaks every edge of the page rather
 * than only a request that pages from that row.
 */
export function encodeCursorChunk(value: unknown): string {
  if (value == null) {
    return 'Z:';
  }

  if (value instanceof Date) {
    return `D:${String(Number(value))}`;
  }

  // `Buffer` is a `Uint8Array`, so this covers both.
  if (value instanceof Uint8Array) {
    return `B:${encodeBase64Bytes(value)}`;
  }

  switch (typeof value) {
    case 'number':
      return `N:${value}`;
    case 'string':
      return `S:${value}`;
    case 'bigint':
      return `I:${value}`;
    case 'boolean':
      return `O:${value}`;
    case 'object':
      if (isDecimalLike(value)) {
        return `M:${value.toFixed()}`;
      }

      return `O:${JSON.stringify(value)}`;
    default:
      throw new PothosValidationError(`Unsupported cursor type ${typeof value}`);
  }
}

/**
 * Encodes several cursor values as one chunk, each part keeping its own tag.
 *
 * A nullish part is a JSON `null` rather than a `Z:` chunk, which is what compound cursors
 * already in the wild hold, and they have to keep decoding byte for byte the same way.
 */
export function encodeCursorTuple(values: readonly unknown[]): string {
  return `T:${JSON.stringify(values.map((value) => (value == null ? null : encodeCursorChunk(value))))}`;
}

/**
 * Reads a tagged chunk back. A `T:` chunk yields an array; every other tag yields the value.
 *
 * A decimal comes back as its exact decimal string rather than as a `Decimal`: this module has
 * no decimal class to build, and both ORMs accept a decimal string wherever they accept one.
 */
export function decodeCursorChunk(chunk: unknown): unknown {
  if (typeof chunk !== 'string') {
    throw new PothosValidationError('Cursor chunk must be a string');
  }

  // `[\s\S]`, not `.`: a string value may contain a newline, and `.` would cut the payload at it.
  const match = CHUNK_PATTERN.exec(chunk);

  if (!match) {
    throw new PothosValidationError(`Invalid cursor chunk: ${chunk}`);
  }

  const [, tag, payload] = match;

  switch (tag) {
    case 'S':
      return payload;
    // `Number`, not `parseInt`: a cursor on a float column holds `N:1.75`, which `parseInt`
    // truncates to `1`, and a large number's `N:1e+21`, which it reads as `1`.
    case 'N':
      return Number(payload);
    case 'I':
      return BigInt(payload);
    case 'D':
      return new Date(Number.parseInt(payload, 10));
    case 'B':
      return decodeBase64Bytes(payload);
    case 'M':
      return payload;
    case 'O':
      return JSON.parse(payload) as unknown;
    case 'Z':
      return null;
    case 'T':
      return decodeCursorTuple(payload);
    /**
     * @deprecated `J:` is a compound cursor from before each part carried its own tag: a bare
     * JSON array, so a Date arrives as a string and a bigint could not be written at all.
     * Retained so cursors issued before this release keep working, and removed in the next
     * major -- `T:` covers everything it did. Nothing writes it.
     */
    case 'J':
      return JSON.parse(payload) as unknown;
    default:
      throw new PothosValidationError(`Invalid cursor type ${tag}`);
  }
}

function decodeCursorTuple(payload: string) {
  const parts = JSON.parse(payload) as unknown;

  if (!Array.isArray(parts)) {
    throw new PothosValidationError(
      `Expected compound cursor to contain an array, but got ${payload}`,
    );
  }

  return parts.map((part) => (part === null ? null : decodeCursorChunk(part)));
}
