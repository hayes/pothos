// @ts-nocheck
import SchemaBuilder, { isThenable, MaybePromise, SchemaTypes } from '../core/index.ts';
import RequestCache from './request-cache.ts';
import { AuthFailure, ForbiddenError } from './index.ts';
const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
// eslint-disable-next-line consistent-return
schemaBuilderProto.runAuthScopes = function runAuthScopes(context, scopes, unauthorizedError = (result) => new ForbiddenError(result.message, result.failure)): MaybePromise<void> {
    const cache = RequestCache.fromContext(context, this);
    const resultOrPromise = cache.evaluateScopeMap(scopes);
    if (isThenable(resultOrPromise)) {
        return resultOrPromise.then(handleScopeResult);
    }
    handleScopeResult(resultOrPromise);
    function handleScopeResult(result: AuthFailure | null) {
        if (result) {
            const error = unauthorizedError({
                message: "Unauthorized",
                failure: result,
            });
            if (typeof error === "string") {
                throw new ForbiddenError(error, result);
            }
            throw error;
        }
    }
};
