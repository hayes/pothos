import type { MaybePromise, SchemaTypes } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { ZodError, ZodSchema } from 'zod';

export interface ValidationPluginOptions<Types extends SchemaTypes> {
  validationError?: ValidationErrorFn<Types>;
}

export type ValidationErrorFn<Types extends SchemaTypes> = (
  error: ZodError,
  args: Record<string, unknown>,
  context: Types['Context'],
  info: GraphQLResolveInfo,
) => Error | string;
