// @ts-nocheck
import { type MaybePromise, type PothosOutputFieldConfig, type SchemaTypes, isThenable, } from '../core/index.ts';
import type { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { ForbiddenError } from './errors.ts';
import RequestCache from './request-cache.ts';
import { AuthScopeFailureType, type ResolveStep, type UnauthorizedResolver } from './types.ts';
import type { PothosScopeAuthPlugin, UnauthorizedErrorFn } from './index.ts';
const defaultUnauthorizedResolver: UnauthorizedResolver<never, never, never, never, never> = (_root, _args, _context, _info, error) => {
    throw error;
};
export function resolveHelper<Types extends SchemaTypes>(steps: ResolveStep<Types>[], plugin: PothosScopeAuthPlugin<Types>, fieldConfig: PothosOutputFieldConfig<Types>) {
    const unauthorizedResolver = fieldConfig.pothosOptions.unauthorizedResolver ?? defaultUnauthorizedResolver;
    const globalUnauthorizedError = plugin.builder.options.scopeAuth?.unauthorizedError;
    const defaultUnauthorizedError: UnauthorizedErrorFn<Types, object, {}> = (parent, _args, context, info, result) => {
        if (globalUnauthorizedError) {
            return globalUnauthorizedError(parent, context, info, result);
        }
        if ((result.failure.kind === AuthScopeFailureType.AuthScope ||
            result.failure.kind === AuthScopeFailureType.AuthScopeFunction) &&
            result.failure.error) {
            return result.failure.error;
        }
        return result.message;
    };
    const createError: UnauthorizedErrorFn<Types, object, {}> = fieldConfig.pothosOptions.unauthorizedError ?? defaultUnauthorizedError;
    return (parent: unknown, args: {}, context: Types["Context"], info: GraphQLResolveInfo) => {
        let resolvedValue: unknown;
        const cache = RequestCache.fromContext(context, plugin.builder);
        function runSteps(index: number): MaybePromise<unknown> {
            for (let i = index; i < steps.length; i += 1) {
                const { run, errorMessage } = steps[i];
                const stepResult = run(cache, parent, args, context, info, (val) => {
                    resolvedValue = val;
                });
                if (isThenable(stepResult)) {
                    return stepResult.then((result) => {
                        if (result) {
                            const error = createError(parent as object, args, context, info, {
                                message: typeof errorMessage === "function"
                                    ? errorMessage(parent, args, context, info)
                                    : errorMessage,
                                failure: result,
                            });
                            return unauthorizedResolver(parent as never, args, context as never, info, typeof error === "string" ? new ForbiddenError(error, result) : error);
                        }
                        return runSteps(i + 1);
                    });
                }
                if (stepResult) {
                    const error = createError(parent as object, args, context, info, {
                        message: typeof errorMessage === "function"
                            ? errorMessage(parent, args, context, info)
                            : errorMessage,
                        failure: stepResult,
                    });
                    return unauthorizedResolver(parent as never, args, context as never, info, typeof error === "string" ? new ForbiddenError(error, stepResult) : error);
                }
            }
            return resolvedValue;
        }
        return runSteps(0);
    };
}
