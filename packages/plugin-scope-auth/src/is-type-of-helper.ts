import { GraphQLIsTypeOfFn, GraphQLResolveInfo } from 'graphql';
import { isThenable, MaybePromise, SchemaTypes } from '@pothos/core';
import { ForbiddenError } from './errors';
import RequestCache from './request-cache';

import type { PothosScopeAuthPlugin, ResolveStep, UnauthorizedForTypeErrorFn } from '.';

export function isTypeOfHelper<Types extends SchemaTypes>(
  steps: ResolveStep<Types>[],
  plugin: PothosScopeAuthPlugin<Types>,
  isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
) {
  const globalUnauthorizedError = plugin.builder.options.scopeAuth?.unauthorizedError;
  const createError: UnauthorizedForTypeErrorFn<Types, object> = (parent, context, info, result) =>
    globalUnauthorizedError
      ? globalUnauthorizedError(parent, context, info, result)
      : result.message;

  return (parent: unknown, context: Types['Context'], info: GraphQLResolveInfo) => {
    const cache = RequestCache.fromContext(context, plugin.builder);

    function runSteps(index: number): MaybePromise<boolean> {
      for (let i = index; i < steps.length; i += 1) {
        const { run, errorMessage } = steps[i];

        const stepResult = run(cache, parent, {}, context, info, () => {});

        if (isThenable(stepResult)) {
          return stepResult.then((result) => {
            if (result) {
              const error = createError(parent as object, context, info, {
                message:
                  typeof errorMessage === 'function'
                    ? errorMessage(parent, {}, context, info)
                    : errorMessage,
                failure: result,
              });

              throw typeof error === 'string' ? new ForbiddenError(error, result) : error;
            }

            return runSteps(i + 1);
          });
        }

        if (stepResult) {
          const error = createError(parent as object, context, info, {
            message:
              typeof errorMessage === 'function'
                ? errorMessage(parent, {}, context, info)
                : errorMessage,
            failure: stepResult,
          });

          throw typeof error === 'string' ? new ForbiddenError(error, stepResult) : error;
        }
      }

      return isTypeOf ? isTypeOf(parent, context, info) : true;
    }

    return runSteps(0);
  };
}
