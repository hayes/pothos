import { type PartialResolveInfo, PothosValidationError, type SchemaTypes } from '@pothos/core';
import { decodeGlobalID, encodeGlobalID } from './global-ids.js';

export function internalEncodeGlobalID<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  typename: string,
  id: bigint | number | string,
  ctx: object,
) {
  if (builder.options.relay?.encodeGlobalID) {
    return builder.options.relay.encodeGlobalID(typename, id, ctx);
  }

  return encodeGlobalID(typename, id);
}

function getParseGlobalID(typename: string, info: PartialResolveInfo) {
  return info.schema.getType(typename)?.extensions?.pothosParseGlobalID as
    | ((id: string, ctx: object) => unknown)
    | undefined;
}

const rawGlobalIDs = new WeakMap<object, string>();

function withRawGlobalID<T extends object>(globalID: T, rawId: string): T {
  rawGlobalIDs.set(globalID, rawId);

  return globalID;
}

export function getRawGlobalID(globalID: object): string | undefined {
  return rawGlobalIDs.get(globalID);
}

export function internalNormalizeGlobalIDShape(
  typename: string,
  id: unknown,
  ctx: object,
  info: PartialResolveInfo,
): { id: unknown; typename: string } {
  const parseID = getParseGlobalID(typename, info);

  if (!parseID) {
    return withRawGlobalID({ typename, id }, String(id));
  }

  const rawId = String(id);

  return withRawGlobalID({ typename, id: parseID(rawId, ctx) }, rawId);
}

export function internalDecodeGlobalID<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  globalID: string,
  ctx: object,
  info: PartialResolveInfo,
  parseIdsForTypes: { typename: string; parseId: (id: string, ctx: object) => unknown }[] | boolean,
) {
  const decoded = builder.options.relay?.decodeGlobalID
    ? builder.options.relay.decodeGlobalID(globalID, ctx)
    : decodeGlobalID(globalID);

  if (Array.isArray(parseIdsForTypes)) {
    const entry = parseIdsForTypes.find(({ typename }) => typename === decoded.typename);
    if (!entry) {
      throw new PothosValidationError(
        `ID: ${globalID} is not of type: ${parseIdsForTypes
          .map(({ typename }) => typename)
          .join(', ')}`,
      );
    }

    if (entry.parseId) {
      return withRawGlobalID({ ...decoded, id: entry.parseId(decoded.id, ctx) }, decoded.id);
    }

    return withRawGlobalID(decoded, decoded.id);
  }

  if (parseIdsForTypes) {
    const parseID = getParseGlobalID(decoded.typename, info);

    if (parseID) {
      return withRawGlobalID({ ...decoded, id: parseID(decoded.id, ctx) }, decoded.id);
    }
  }

  return withRawGlobalID(decoded, decoded.id);
}
