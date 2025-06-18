import { PothosValidationError } from '@pothos/core';
import type { AuthFailure } from '.';
import { AuthScopeFailureType } from './types';

export class ForbiddenError extends PothosValidationError {
  code = 'FORBIDDEN';

  result: AuthFailure;

  constructor(message: string, result?: AuthFailure) {
    super(message);

    this.name = 'ForbiddenError';
    this.result = result ?? { kind: AuthScopeFailureType.Unknown };

    Object.defineProperty(this, 'name', { value: 'ForbiddenError' });
  }
}
