// @ts-nocheck
import { decodeBase64, encodeBase64, PothosValidationError } from '../../core/index.ts';
export function encodeGlobalID(typename: string, id: bigint | number | string) {
    return encodeBase64(`${typename}:${id}`);
}
export function decodeGlobalID(globalID: string) {
    const [typename, id] = decodeBase64(globalID).split(":");
    if (!typename || !id) {
        throw new PothosValidationError(`Invalid global ID: ${globalID}`);
    }
    return { typename, id };
}
