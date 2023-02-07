// @ts-nocheck
import { PothosValidationError } from '../core/index.ts';
import { AuthScopeFailureType } from './types.ts';
import type { AuthFailure } from './index.ts';
export class ForbiddenError extends PothosValidationError {
    code = "FORBIDDEN";
    result: AuthFailure;
    constructor(message: string, result?: AuthFailure) {
        super(message);
        this.name = "ForbiddenError";
        this.result = result ?? { kind: AuthScopeFailureType.Unknown };
        Object.defineProperty(this, "name", { value: "ForbiddenError" });
    }
}
