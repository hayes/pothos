import type { SchemaTypes } from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema';

export interface ValidationPluginOptions<Types extends SchemaTypes> {
  validationError?: ValidationErrorFn<Types>;
}

export type ValidationErrorFn<Types extends SchemaTypes> = (
  failure: StandardSchemaV1.FailureResult,
  args: Record<string, unknown>,
  context: Types['Context'],
) => Error | string;
