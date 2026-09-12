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
      return {
        ...decoded,
        id: entry.parseId(decoded.id, ctx),
        // The parsed id may be any shape, and is not usable as an identity. Keep the
        // decoded global ID so node identity never depends on the parse result.
        rawId: decoded.id,
      };
    }

    return decoded;
  }

  if (parseIdsForTypes) {
    const parseID = info.schema.getType(decoded.typename)?.extensions?.pothosParseGlobalID as (
      id: string,
      ctx: object,
    ) => string;

    if (parseID) {
      return {
        ...decoded,
        id: parseID(decoded.id, ctx),
        rawId: decoded.id,
      };
    }
  }

  return decoded;
}
