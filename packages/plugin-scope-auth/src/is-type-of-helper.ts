import { isThenable, type MaybePromise, type SchemaTypes } from '@pothos/core';
import type { GraphQLIsTypeOfFn, GraphQLResolveInfo } from 'graphql';
import { ForbiddenError } from './errors.js';
import type {
  AuthFailure,
  PothosScopeAuthPlugin,
  ResolveStep,
  ScopeAuthParentLoader,
  UnauthorizedForTypeErrorFn,
} from './index.js';
import RequestCache from './request-cache.js';
import { AuthScopeFailureType } from './types.js';

export function isTypeOfHelper<Types extends SchemaTypes>(
  steps: ResolveStep<Types>[],
  plugin: PothosScopeAuthPlugin<Types>,
  isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
  loadParent?: ScopeAuthParentLoader<Types['Context']>,
) {
  const globalUnauthorizedError = plugin.builder.options.scopeAuth?.unauthorizedError;
  const createError: UnauthorizedForTypeErrorFn<Types, object> = (parent, context, info, result) =>
    globalUnauthorizedError
      ? globalUnauthorizedError(parent, context, info, result)
      : result.message;

  return (source: unknown, context: Types['Context'], info: GraphQLResolveInfo) => {
    // graphql-jit calls isTypeOf with only the value, and treats a promise as a match, so a check
    // that loads its parent fails there rather than passing before the parent loads.
    if (loadParent && info === undefined) {
      return false;
    }

    const cache = RequestCache.fromContext(context, plugin.builder);

    // The steps see the parent `loadParent` returns, but `isTypeOf` gets the value it was passed.
    function runSteps(parent: unknown, index: number): MaybePromise<boolean> {
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

            return runSteps(parent, i + 1);
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

      return isTypeOf ? isTypeOf(source, context, info) : true;
    }

    if (!loadParent) {
      return runSteps(source, 0);
    }

    // A parent that fails to load fails the first check, as its own denial, so the client can't
    // tell the two apart. What the loader threw is the error's `cause`.
    const deny = (cause: unknown): never => {
      const { errorMessage } = steps[0];
      const failure: AuthFailure = { kind: AuthScopeFailureType.Unknown };
      const error = createError(source as object, context, info, {
        message:
          typeof errorMessage === 'function'
            ? errorMessage(source, {}, context, info)
            : errorMessage,
        failure,
      });
      const denial = typeof error === 'string' ? new ForbiddenError(error, failure) : error;

      if (denial.cause === undefined) {
        denial.cause = cause;
      }

      throw denial;
    };

    let parent: MaybePromise<unknown>;

    try {
      parent = loadParent(source, context, info);
    } catch (error) {
      return deny(error);
    }

    if (isThenable(parent)) {
      return Promise.resolve(parent).then((loaded) => runSteps(loaded, 0), deny);
    }

    return runSteps(parent, 0);
  };
}
