import { GraphQLResolveInfo } from 'graphql';
import { isThenable, MaybePromise, SchemaTypes } from '@giraphql/core';
import { ForbiddenError } from './errors';
import RequestCache from './request-cache';
import ResolveState from './resolve-state';
import { ResolveStep } from './types';
import { GiraphQLScopeAuthPlugin } from '.';

export function resolveHelper<Types extends SchemaTypes>(
  steps: ResolveStep<Types>[],
  plugin: GiraphQLScopeAuthPlugin<Types>,
) {
  return (parent: unknown, args: {}, context: Types['Context'], info: GraphQLResolveInfo) => {
    const state = new ResolveState(RequestCache.fromContext(context, plugin));

    function runSteps(index: number): MaybePromise<unknown> {
      for (let i = index; i < steps.length; i += 1) {
        const { run, errorMessage } = steps[i];

        const stepResult = run(state, parent, args, context, info);

        if (isThenable(stepResult)) {
          return stepResult.then((result) => {
            if (!result) {
              throw new ForbiddenError(
                typeof errorMessage === 'function'
                  ? errorMessage(parent, args, context, info)
                  : errorMessage,
              );
            }

            return runSteps(i + 1);
          });
        }

        if (!stepResult) {
          throw new ForbiddenError(
            typeof errorMessage === 'function'
              ? errorMessage(parent, args, context, info)
              : errorMessage,
          );
        }
      }

      return state.resolveValue;
    }

    return runSteps(0);
  };
}
