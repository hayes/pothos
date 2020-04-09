import { PermissionMatcher } from '../types';

export async function evaluateMatcher(
  matcher: PermissionMatcher,
  fieldName: string,
  getResult: (perm: string) => Promise<boolean>,
  failedChecks: Set<string> = new Set(),
): Promise<null | {
  failedChecks: Set<string>;
  type: 'any' | 'all';
}> {
  const pending: Promise<unknown>[] = [];
  if (matcher.all) {
    if (matcher.all.length === 0) {
      throw new Error(
        `Received an "all" permission matcher with an empty empty list of permissions for ${fieldName}`,
      );
    }
    for (const perm of matcher.all) {
      const permPromise =
        typeof perm === 'string'
          ? getResult(perm).then((result) => {
              if (!result) {
                failedChecks.add(perm);
              }
              return result;
            })
          : evaluateMatcher(perm, fieldName, getResult, failedChecks).then((result) => !result);
      if (matcher.sequential) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await permPromise)) {
          break;
        }
      } else {
        pending.push(permPromise);
      }
    }
    await Promise.all(pending);
    if (failedChecks.size === 0) {
      return null;
    }
  } else {
    if (matcher.any.length === 0) {
      throw new Error(
        `Received an "any" permission matcher with an empty empty list of permissions for ${fieldName}`,
      );
    }
    for (const perm of matcher.any) {
      const permPromise =
        typeof perm === 'string'
          ? getResult(perm).then((result) => {
              if (!result) {
                failedChecks.add(perm);
              }
              return result;
            })
          : evaluateMatcher(perm, fieldName, getResult, failedChecks).then((result) => !result);
      if (matcher.sequential) {
        // eslint-disable-next-line no-await-in-loop
        if (await permPromise) {
          return null;
        }
      } else {
        pending.push(permPromise);
      }
    }
    const results = await Promise.all(pending);
    if (results.find((value) => value)) {
      return null;
    }
  }
  return {
    type: matcher.all ? 'all' : 'any',
    failedChecks,
  };
}
