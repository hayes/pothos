import { GraphQLResolveInfo } from 'graphql';
import { SchemaTypes } from '@pothos/core';
import { decodeGlobalID, encodeGlobalID } from './global-ids';

export function internalEncodeGlobalID<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  typename: string,
  id: bigint | number | string,
  ctx: object,
) {
  if (builder.options.relayOptions.encodeGlobalID) {
    return builder.options.relayOptions.encodeGlobalID(typename, id, ctx);
  }

  return encodeGlobalID(typename, id);
}

export function internalDecodeGlobalID<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  globalID: string,
  ctx: object,
  info: GraphQLResolveInfo,
  types?: string[] | null,
) {
  const decoded = builder.options.relayOptions.decodeGlobalID
    ? builder.options.relayOptions.decodeGlobalID(globalID, ctx)
    : decodeGlobalID(globalID);

  if (types && !types.includes(decoded.typename)) {
    throw new Error(`ID: ${globalID} is not of type: ${types.join(', ')}`);
  }

  const parseID = info.schema.getType(decoded.typename)?.extensions?.pothosParseGlobalID as (
    id: string,
    ctx: object,
  ) => string;

  if (!parseID) {
    return decoded;
  }

  return {
    ...decoded,
    id: parseID(decoded.id, ctx),
  };
}
