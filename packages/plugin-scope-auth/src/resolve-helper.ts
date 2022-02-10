import { GraphQLResolveInfo } from 'graphql';
import { isThenable, MaybePromise, PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';
import { ForbiddenError } from './errors';
import RequestCache from './request-cache';
import ResolveState from './resolve-state';
import { CustomAuthError, ResolveStep, UnauthorizedResolver } from './types';
import { PothosScopeAuthPlugin } from '.';

const defaultUnauthorizedResolver: UnauthorizedResolver<
  never,
  never,
  never,
  never,
  never,
  typeof Error
> = (_root, _args, _context, _info, error) => {
  throw error;
};

export function resolveHelper<Types extends SchemaTypes>(
  steps: ResolveStep<Types>[],
  plugin: PothosScopeAuthPlugin<Types>,
  fieldConfig: PothosOutputFieldConfig<Types>,
  globalCustomError:
    | CustomAuthError<Types, never, never, never, never, ErrorConstructor>
    | undefined,
) {
  const unauthorizedResolver =
    fieldConfig.pothosOptions.unauthorizedResolver ??
    globalCustomError?.unauthorizedResolver ??
    defaultUnauthorizedResolver;

  const UnauthorizedError =
    fieldConfig.pothosOptions.unauthorizedError ??
    globalCustomError?.unauthorizedError ??
    ForbiddenError;

  const UnauthorizedErrorMessage =
    fieldConfig.pothosOptions.unauthorizedErrorMessage ??
    globalCustomError?.unauthorizedErrorMessage;

  return (parent: unknown, args: {}, context: Types['Context'], info: GraphQLResolveInfo) => {
    const state = new ResolveState(RequestCache.fromContext(context, plugin));

    function runSteps(index: number): MaybePromise<unknown> {
      for (let i = index; i < steps.length; i += 1) {
        const { run, errorMessage } = steps[i];

        const stepResult = run(state, parent, args, context, info);

        if (isThenable(stepResult)) {
          return stepResult.then((result) => {
            if (result) {
              return unauthorizedResolver(
                parent as never,
                args,
                context as never,
                info,
                new UnauthorizedError(
                  UnauthorizedErrorMessage ??
                    (typeof errorMessage === 'function'
                      ? errorMessage(parent, args, context, info)
                      : errorMessage),
                ),
              );
            }

            return runSteps(i + 1);
          });
        }

        if (stepResult) {
          return unauthorizedResolver(
            parent as never,
            args,
            context as never,
            info,
            new UnauthorizedError(
              UnauthorizedErrorMessage ??
                (typeof errorMessage === 'function'
                  ? errorMessage(parent, args, context, info)
                  : errorMessage),
            ),
          );
        }
      }

      return state.resolveValue;
    }

    return runSteps(0);
  };
}
