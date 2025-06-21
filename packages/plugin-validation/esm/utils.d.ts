import { type InputFieldsMapping, type MaybePromise, type SchemaTypes } from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema.js';
export declare function createArgsValidator<Types extends SchemaTypes>(argMappings: InputFieldsMapping<Types, {
    typeSchemas: StandardSchemaV1[];
    fieldSchemas: StandardSchemaV1[];
}> | null, argsSchema: StandardSchemaV1 | null): (args: Record<string, unknown>) => MaybePromise<Record<string, unknown>>;
//# sourceMappingURL=utils.d.ts.map
