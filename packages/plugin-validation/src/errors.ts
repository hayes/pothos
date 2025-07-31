import { PothosValidationError } from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema';
export class InputValidationError extends PothosValidationError {
  issues: readonly StandardSchemaV1.Issue[];

  constructor({ issues }: StandardSchemaV1.FailureResult) {
    super(
      `Validation error: ${issues
        .map((issue) => {
          return `${
            issue.path
              ?.map((path) => {
                if (
                  typeof path === 'string' ||
                  typeof path === 'number' ||
                  typeof path === 'symbol'
                ) {
                  return path.toString();
                }
                return path.key.toString();
              })
              .join('.') ?? 'unknown'
          }: ${issue.message}`;
        })
        .join(', ')}`,
    );

    this.issues = issues;
  }
}
