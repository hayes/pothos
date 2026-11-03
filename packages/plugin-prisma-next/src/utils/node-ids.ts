import { encodeCursorChunk, PothosValidationError } from '@pothos/core';
import type { FieldCodecs } from './codecs.js';
import { decodeValues, encodeValues } from './cursors.js';

/** Tags node IDs that aren't plain strings, so they decode back to their own type. */
const ID_PREFIX = 'PNI:';

export function encodeNodeId(
  modelKey: string,
  fields: readonly string[],
  row: Record<string, unknown>,
  codecs: FieldCodecs,
): string {
  const values = fields.map((field) => {
    // A missing value would encode as null, an ID no row has.
    if (row[field] == null) {
      throw new Error(`prismaNode '${modelKey}' row is missing id field '${field}'.`);
    }
    return row[field];
  });
  const payload = encodeValues(fields, values, codecs);
  // A string stays readable unless it could be mistaken for a tagged payload.
  return payload.startsWith('S:') && !payload.startsWith(`S:${ID_PREFIX}`)
    ? payload.slice(2)
    : `${ID_PREFIX}${payload}`;
}

/** Decodes a node ID. Returns a tuple of the values of `fields` when `tuple` is set. */
export function parseNodeId(
  fields: readonly string[],
  id: string,
  codecs: FieldCodecs,
  { tuple }: { tuple: boolean },
): unknown {
  const values = decodeValues(
    fields,
    id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : encodeCursorChunk(id),
    codecs,
  );
  if (!values) {
    throw new PothosValidationError('Invalid ID.');
  }
  return tuple ? fields.map((field) => values[field]) : values[fields[0]!];
}
