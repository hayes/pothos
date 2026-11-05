import {
  isThenable,
  type MaybePromise,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { ForbiddenError } from './errors.js';
import type { PothosScopeAuthPlugin, UnauthorizedErrorFn } from './index.js';
import RequestCache from './request-cache.js';
import {
  type AuthFailure,
  AuthScopeFailureType,
  type ResolveStep,
  type ScopeAuthParentLoader,
  type UnauthorizedResolver,
} from './types.js';

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
  loadParent?: ScopeAuthParentLoader<Types['Context']>,
) {
  const unauthorizedResolver =
    fieldConfig.pothosOptions.unauthorizedResolver ?? defaultUnauthorizedResolver;

  const globalUnauthorizedError = plugin.builder.options.scopeAuth?.unauthorizedError;
  const defaultUnauthorizedError: UnauthorizedErrorFn<Types, object, {}> = (
    parent,
    _args,
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

  // `checked` is the parent the failing check saw. `unauthorizedResolver` gets the original.
  const fail = (
    parent: unknown,
    checked: unknown,
    args: {},
    context: Types['Context'],
    info: GraphQLResolveInfo,
    result: AuthFailure,
    errorMessage: ResolveStep<Types>['errorMessage'],
  ) => {
    const error = createError(checked as object, args, context, info, {
      message:
        typeof errorMessage === 'function'
          ? errorMessage(checked, args, context, info)
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
  };

  // Loads the parent once per field, before the first check that reads it.
  const load = loadParent && steps.some((step) => step.readsParent) ? loadParent : undefined;

  return (parent: unknown, args: {}, context: Types['Context'], info: GraphQLResolveInfo) => {
    let resolvedValue: unknown;
    // The parent the checks see. The resolver gets the original.
    let checked = parent;
    let pending = !!load;

    const cache = RequestCache.fromContext(context, plugin.builder);

    function runSteps(index: number): MaybePromise<unknown> {
      for (let i = index; i < steps.length; i += 1) {
        const { run, errorMessage, readsParent } = steps[i];

        if (pending && readsParent) {
          pending = false;
          const loaded = load!(parent, context, info);

          if (isThenable(loaded)) {
            return Promise.resolve(loaded).then((value) => {
              checked = value;

              return runSteps(i);
            });
          }

          checked = loaded;
        }

        const stepResult = run(
          cache,
          readsParent ? checked : parent,
          args,
          context,
          info,
          (val) => {
            resolvedValue = val;
          },
        );

        if (isThenable(stepResult)) {
          return stepResult.then((result) =>
            result
              ? fail(parent, checked, args, context, info, result, errorMessage)
              : runSteps(i + 1),
          );
        }

        if (stepResult) {
          return fail(parent, checked, args, context, info, stepResult, errorMessage);
        }
      }

      return resolvedValue;
    }

    return runSteps(0);
  };
}
