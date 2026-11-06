import { PothosValidationError } from '@pothos/core';
import type { FieldCodecs } from './codecs.js';
import { InternalError } from './errors.js';

/**
 * Node IDs use plugin-prisma's format: a value's stored form, as it is when it's a string and as
 * JSON otherwise, and a JSON array of those for several fields.
 */
export function encodeNodeId(
  modelKey: string,
  fields: readonly string[],
  row: Record<string, unknown>,
  codecs: FieldCodecs,
): string {
  const parts = fields.map((field) => {
    // A missing value would encode as null, an ID no row has.
    if (row[field] == null) {
      throw new InternalError(`prismaNode '${modelKey}' row is missing id field '${field}'.`);
    }
    let stored: unknown;
    try {
      stored = codecs(field).encode(row[field]);
    } catch (error) {
      throw new InternalError(
        `prismaNode '${modelKey}' id field '${field}' holds a value its column can't store.`,
        { cause: error },
      );
    }
    return typeof stored === 'string' ? stored : JSON.stringify(stored);
  });
  return parts.length === 1 ? parts[0]! : JSON.stringify(parts);
}

/**
 * A value's stored form is read as the string first, so a string column keeps IDs that look like
 * JSON, and a codec refuses a stored form of the wrong type.
 */
function decodePart(codecs: FieldCodecs, field: string, part: string): unknown {
  const codec = codecs(field);
  try {
    return codec.decode(part);
  } catch {
    return codec.decode(JSON.parse(part));
  }
}

/** Decodes a node ID. Returns a tuple of the values of `fields` when `tuple` is set. */
export function parseNodeId(
  fields: readonly string[],
  id: string,
  codecs: FieldCodecs,
  { tuple }: { tuple: boolean },
): unknown {
  try {
    const parts: unknown = fields.length === 1 ? [id] : JSON.parse(id);
    if (
      Array.isArray(parts) &&
      parts.length === fields.length &&
      parts.every((part) => typeof part === 'string')
    ) {
      const values = fields.map((field, i) => decodePart(codecs, field, parts[i]));
      return tuple ? values : values[0];
    }
  } catch {
    // A codec's or JSON's error names the value, which the client sees only as an invalid ID.
  }
  throw new PothosValidationError('Invalid ID.');
}
