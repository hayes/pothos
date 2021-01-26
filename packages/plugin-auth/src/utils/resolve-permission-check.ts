import { isThenable, MaybePromise } from '@giraphql/core';
import { PermissionCheck, PermissionMatcher } from '../types';

export function resolvePermissionCheck(
  check: PermissionCheck<any, any, any>,
  parent: unknown,
  args: unknown,
  context: unknown,
): MaybePromise<PermissionMatcher | boolean> {
  if (typeof check === 'string') {
    return { all: [check] };
  }
  if (Array.isArray(check)) {
    return { all: check };
  }
  if (typeof check !== 'function') {
    return check;
  }

  const resultOrPromise = check(parent, args, context);

  return isThenable(resultOrPromise)
    ? resultOrPromise.then(normalizeResult)
    : normalizeResult(resultOrPromise);
}

function normalizeResult(result: boolean | string | string[] | PermissionMatcher) {
  if (typeof result === 'string') {
    return { all: [result] };
  }
  if (Array.isArray(result)) {
    return { all: result };
  }

  return result;
}
