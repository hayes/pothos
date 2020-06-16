import { ResolveValueWrapper } from '@giraphql/core';
import { ForbiddenError } from 'apollo-server';
import { resolvePermissionCheck } from './utils/resolve-permission-check';
import { evaluateMatcher } from './utils/evaluate-matcher';

export async function checkFieldPermissions(
  required: boolean,
  parent: ResolveValueWrapper,
  data: GiraphQLSchemaTypes.FieldWrapData,
  args: object,
  context: object,
) {
  const { fieldName, parentType, permissionCheckers, permissionCheck } = data.giraphqlAuth;

  if (Array.isArray(permissionCheck) && permissionCheck.length === 0) {
    if (required) {
      throw new ForbiddenError(`Missing permission check on ${fieldName}.`);
    }
    return;
  }

  const checkResult = await resolvePermissionCheck(permissionCheck, parent.value, args, context);

  if (typeof checkResult === 'boolean') {
    if (!checkResult) {
      throw new ForbiddenError(`Permission check on ${fieldName} failed.`);
    }
    return;
  }

  const { grantedPermissions, checkCache } = parent.data.giraphqlAuth!;
  const permissionResults = new Map<string, boolean>();

  const failures = await evaluateMatcher(checkResult, fieldName, async (perm) => {
    if (permissionResults.has(perm)) {
      return permissionResults.has(perm);
    }

    if (grantedPermissions.hasPermission(parentType.name, perm)) {
      permissionResults.set(perm, true);
      return true;
    }

    if (permissionCheckers[perm]) {
      if (!checkCache[perm]) {
        checkCache[perm] = permissionCheckers[perm](parent.value, context);
      }

      const result = await checkCache[perm];
      permissionResults.set(perm, result);
      return result;
    }

    return false;
  });

  if (failures) {
    const { failedChecks, type } = failures;

    if (type === 'any') {
      throw new ForbiddenError(
        `Permission check on ${fieldName} failed. Missing ${
          failedChecks.size > 1 ? 'one of the following permissions' : 'the following permission'
        }: ${[...failedChecks].join(', ')})`,
      );
    }

    throw new ForbiddenError(
      `Permission check on ${fieldName} failed. Missing the following permission${
        failedChecks.size > 1 ? 's' : ''
      }: ${[...failedChecks].join(', ')}`,
    );
  }
}
