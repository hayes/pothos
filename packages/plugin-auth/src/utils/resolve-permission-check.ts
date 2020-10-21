import { PermissionCheck, PermissionMatcher } from '../types';

export async function resolvePermissionCheck(
  check: PermissionCheck<any, any, any>,
  parent: unknown,
  args: unknown,
  context: unknown,
): Promise<PermissionMatcher | boolean> {
  if (typeof check === 'string') {
    return { all: [check] };
  }
  if (Array.isArray(check)) {
    return { all: check };
  }
  if (typeof check !== 'function') {
    return check;
  }
  const result = await check(parent, args, context);
  if (typeof result === 'string') {
    return { all: [result] };
  }
  if (Array.isArray(result)) {
    return { all: result };
  }
  
return result;
}
