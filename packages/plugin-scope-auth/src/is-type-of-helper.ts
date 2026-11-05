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

  const fail = (
    parent: unknown,
    context: Types['Context'],
    info: GraphQLResolveInfo,
    result: AuthFailure,
    errorMessage: ResolveStep<Types>['errorMessage'],
  ): never => {
    const error = createError(parent as object, context, info, {
      message:
        typeof errorMessage === 'function' ? errorMessage(parent, {}, context, info) : errorMessage,
      failure: result,
    });

    throw typeof error === 'string' ? new ForbiddenError(error, result) : error;
  };

  const load = loadParent && steps.some((step) => step.readsParent) ? loadParent : undefined;

  return (source: unknown, context: Types['Context'], info: GraphQLResolveInfo) => {
    // graphql-jit calls isTypeOf with only the value, and treats a promise as a match, so a check
    // that loads its parent fails there rather than passing before the parent loads.
    if (load && info === undefined) {
      return false;
    }

    const cache = RequestCache.fromContext(context, plugin.builder);
    // The parent the checks see, loaded before the first check that reads it. `isTypeOf` gets the
    // value it was passed.
    let parent = source;
    let pending = !!load;

    function runSteps(index: number): MaybePromise<boolean> {
      for (let i = index; i < steps.length; i += 1) {
        const { run, errorMessage, readsParent } = steps[i];

        if (pending && readsParent) {
          pending = false;
          const loaded = load!(source, context, info);

          if (isThenable(loaded)) {
            return Promise.resolve(loaded).then((value) => {
              parent = value;

              return runSteps(i);
            });
          }

          parent = loaded;
        }

        const stepResult = run(cache, parent, {}, context, info, () => {});

        if (isThenable(stepResult)) {
          return stepResult.then((result) => {
            if (result) {
              fail(parent, context, info, result, errorMessage);
            }

            return runSteps(i + 1);
          });
        }

        if (stepResult) {
          fail(parent, context, info, stepResult, errorMessage);
        }
      }

      return isTypeOf ? isTypeOf(source, context, info) : true;
    }

    return runSteps(0);
  };
}
