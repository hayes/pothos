import { GraphQLResolveInfo } from 'graphql';
import { isThenable, MaybePromise, PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';
import { ForbiddenError } from './errors';
import RequestCache from './request-cache';
import { AuthScopeFailureType, ResolveStep, UnauthorizedResolver } from './types';

import type { PothosScopeAuthPlugin, UnauthorizedErrorFn } from '.';

const defaultUnauthorizedResolver: UnauthorizedResolver<never, never, never, never, never> = (
  _root,
  _args,
  _context,
  _info,
  error,
) => {
  throw error;
};

export function resolveHelper<Types extends SchemaTypes>(
  steps: ResolveStep<Types>[],
  plugin: PothosScopeAuthPlugin<Types>,
  fieldConfig: PothosOutputFieldConfig<Types>,
) {
  const unauthorizedResolver =
    fieldConfig.pothosOptions.unauthorizedResolver ?? defaultUnauthorizedResolver;

  const globalUnauthorizedError = plugin.builder.options.scopeAuth?.unauthorizedError;
  const defaultUnauthorizedError: UnauthorizedErrorFn<Types, object, {}> = (
    parent,
    args,
    context,
    info,
    result,
  ) => {
    if (globalUnauthorizedError) {
      return globalUnauthorizedError(parent, context, info, result);
    }

    if (
      (result.failure.kind === AuthScopeFailureType.AuthScope ||
        result.failure.kind === AuthScopeFailureType.AuthScopeFunction) &&
      result.failure.error
    ) {
      return result.failure.error;
    }

    return result.message;
  };

  const createError: UnauthorizedErrorFn<Types, object, {}> =
    fieldConfig.pothosOptions.unauthorizedError ?? defaultUnauthorizedError;

  return (parent: unknown, args: {}, context: Types['Context'], info: GraphQLResolveInfo) => {
    let resolvedValue: unknown;

    const cache = RequestCache.fromContext(context, plugin.builder);

    function runSteps(index: number): MaybePromise<unknown> {
      for (let i = index; i < steps.length; i += 1) {
        const { run, errorMessage } = steps[i];

        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const stepResult = run(cache, parent, args, context, info, (val) => {
          resolvedValue = val;
        });

        if (isThenable(stepResult)) {
          return stepResult.then((result) => {
            if (result) {
              const error = createError(parent as object, args, context, info, {
                message:
                  typeof errorMessage === 'function'
                    ? errorMessage(parent, args, context, info)
                    : errorMessage,
                failure: result,
              });

              return unauthorizedResolver(
                parent as never,
                args,
                context as never,
                info,
                typeof error === 'string' ? new ForbiddenError(error, result) : error,
              );
            }

            return runSteps(i + 1);
          });
        }

        if (stepResult) {
          const error = createError(parent as object, args, context, info, {
            message:
              typeof errorMessage === 'function'
                ? errorMessage(parent, args, context, info)
                : errorMessage,
            failure: stepResult,
          });

          return unauthorizedResolver(
            parent as never,
            args,
            context as never,
            info,
            typeof error === 'string' ? new ForbiddenError(error, stepResult) : error,
          );
        }
      }

      return resolvedValue;
    }

    return runSteps(0);
  };
}
