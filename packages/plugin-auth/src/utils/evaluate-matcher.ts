import { PermissionMatcher } from '../types';
import ValueOrPromise from './value-or-promise';

export function evaluateMatcher(
  matcher: PermissionMatcher,
  fieldName: string,
  getResult: (perm: string) => Promise<boolean> | boolean,
  failedChecks: Set<string> = new Set(),
): ValueOrPromise<null | {
  failedChecks: Set<string>;
  type: 'any' | 'all';
}> {
  const type = matcher.all ? 'all' : 'any';

  const result = matcher.sequential
    ? evaluateSequential(matcher[type] || [], type)
    : evaluateParallel(matcher[type] || [], type);

  return result.nowOrThen((passed) =>
    passed
      ? null
      : {
          type: matcher.all ? 'all' : 'any',
          failedChecks,
        },
  );

  function evaluateSequential(perms: (string | PermissionMatcher)[], mode: 'all' | 'any') {
    return new ValueOrPromise(next(0));

    function next(i: number): ValueOrPromise<boolean> | boolean {
      if (i >= perms.length) {
        return mode === 'all';
      }

      return evaluateOne(perms[i]).nowOrThen((result) => {
        if (!result) {
          return mode === 'any' ? true : next(i + 1);
        }

        return mode === 'any' ? next(i + 1) : false;
      });
    }
  }

  function evaluateParallel(perms: (string | PermissionMatcher)[], mode: 'all' | 'any') {
    return ValueOrPromise.all(perms.map(evaluateOne)).nowOrThen((results) =>
      mode === 'all' ? results.every((result) => result) : results.find((result) => result),
    );
  }

  function evaluateOne(perm: string | PermissionMatcher) {
    return typeof perm === 'string'
      ? new ValueOrPromise(getResult(perm)).nowOrThen((result) => {
          if (!result) {
            failedChecks.add(perm);
          }

          return result;
        })
      : evaluateMatcher(perm, fieldName, getResult, failedChecks).nowOrThen((result) => !result);
  }
}
