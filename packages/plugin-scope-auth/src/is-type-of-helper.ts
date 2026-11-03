import { isThenable, type MaybePromise, type SchemaTypes } from '@pothos/core';
import type { GraphQLIsTypeOfFn, GraphQLResolveInfo } from 'graphql';
import { ForbiddenError } from './errors.js';
import type {
  PothosScopeAuthPlugin,
  ResolveStep,
  ScopeAuthParentLoader,
  UnauthorizedForTypeErrorFn,
} from './index.js';
import RequestCache from './request-cache.js';

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
    // Looked up once the steps run: graphql-jit calls isTypeOf without the context.
    let cache: RequestCache<Types> | undefined;

    // The steps see the parent `loadParent` returns, but `isTypeOf` gets the value it was passed.
    function runSteps(parent: unknown, index: number): MaybePromise<boolean> {
      for (let i = index; i < steps.length; i += 1) {
        const { run, errorMessage } = steps[i];

        cache ??= RequestCache.fromContext(context, plugin.builder);

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

    const parent = loadParent(source, context, info);

    if (isThenable(parent)) {
      // graphql-jit calls isTypeOf without info, and treats a promise as a match, so the check
      // fails rather than passing before the parent loads.
      if (info === undefined) {
        parent.then(undefined, () => {});

        return false;
      }

      return Promise.resolve(parent).then((loaded) => runSteps(loaded, 0));
    }

    return runSteps(parent, 0);
  };
}
