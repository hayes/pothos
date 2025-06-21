import { PothosValidationError } from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema.js';
export declare class InputValidationError extends PothosValidationError {
    issues: readonly StandardSchemaV1.Issue[];
    constructor(issues: readonly StandardSchemaV1.Issue[]);
}
//# sourceMappingURL=errors.d.ts.map
