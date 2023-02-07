// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { SchemaTypes } from '../../core/index.ts';
import { decodeGlobalID, encodeGlobalID } from './global-ids.ts';
export function internalEncodeGlobalID<Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>, typename: string, id: bigint | number | string, ctx: object) {
    if (builder.options.relayOptions.encodeGlobalID) {
        return builder.options.relayOptions.encodeGlobalID(typename, id, ctx);
    }
    return encodeGlobalID(typename, id);
}
export function internalDecodeGlobalID<Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>, globalID: string, ctx: object, info: GraphQLResolveInfo, parseIdsForTypes: boolean | string[]) {
    const decoded = builder.options.relayOptions.decodeGlobalID
        ? builder.options.relayOptions.decodeGlobalID(globalID, ctx)
        : decodeGlobalID(globalID);
    if (Array.isArray(parseIdsForTypes) && !parseIdsForTypes.includes(decoded.typename)) {
        throw new Error(`ID: ${globalID} is not of type: ${parseIdsForTypes.join(", ")}`);
    }
    if (parseIdsForTypes !== false) {
        const parseID = info.schema.getType(decoded.typename)?.extensions?.pothosParseGlobalID as (id: string, ctx: object) => string;
        if (parseID) {
            return {
                ...decoded,
                id: parseID(decoded.id, ctx),
            };
        }
    }
    return decoded;
}
