// @ts-nocheck
import { PothosValidationError, decodeBase64, encodeBase64 } from '../../core/index.ts';
export function encodeGlobalID(typename: string, id: bigint | number | string) {
    return encodeBase64(`${typename}:${id}`);
}
const typenameRegex = /^[A-Z_a-z]\w*$/;
export function decodeGlobalID(globalID: string) {
    // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
    let decoded;
    try {
        decoded = decodeBase64(globalID).split(":");
    }
    catch (error) {
        throw error instanceof PothosValidationError
            ? new PothosValidationError(`Invalid global ID: ${globalID}`)
            : error;
    }
    const [typename, id] = decoded;
    if (!typename || !id || !typenameRegex.test(typename)) {
        throw new PothosValidationError(`Invalid global ID: ${globalID}`);
    }
    return { typename, id: decoded.length > 2 ? decoded.slice(1).join(":") : id };
}
