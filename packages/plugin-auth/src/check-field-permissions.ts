import { SchemaTypes } from '@giraphql/core';
import { ForbiddenError } from 'apollo-server';
import { resolvePermissionCheck } from './utils/resolve-permission-check';
import { evaluateMatcher } from './utils/evaluate-matcher';
import { AuthMeta } from '.';
import { AuthFieldWrapper } from './field-wrapper';

export async function checkFieldPermissions<Types extends SchemaTypes>(
  this: AuthFieldWrapper<Types>,
  meta: AuthMeta,
  parent: unknown,
  args: object,
  context: object,
) {
  const required =
    this.requirePermissionChecks &&
    !this.resolveChecks.preResolveMap.has(this.returnTyeConfig.name);

  if (Array.isArray(this.permissionCheck) && this.permissionCheck.length === 0) {
    if (required) {
      throw new ForbiddenError(`Missing permission check on ${this.fieldName}.`);
    }
    return;
  }

  const checkResult = await resolvePermissionCheck(this.permissionCheck, parent, args, context);

  if (typeof checkResult === 'boolean') {
    if (!checkResult) {
      throw new ForbiddenError(`Permission check on ${this.fieldName} failed.`);
    }
    return;
  }

  const { grantedPermissions, checkCache } = meta;

  const permissionResults = new Map<string, boolean>();

  const failures = await evaluateMatcher(checkResult, this.fieldName, async (perm) => {
    if (permissionResults.has(perm)) {
      return permissionResults.has(perm);
    }

    if (grantedPermissions.hasPermission(this.field.parentType, perm)) {
      permissionResults.set(perm, true);
      return true;
    }

    if (this.permissionCheckers[perm]) {
      if (!checkCache[perm]) {
        checkCache[perm] = this.permissionCheckers[perm](parent, context);
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
        `Permission check on ${this.fieldName} failed. Missing ${
          failedChecks.size > 1 ? 'one of the following permissions' : 'the following permission'
        }: ${[...failedChecks].join(', ')})`,
      );
    }

    throw new ForbiddenError(
      `Permission check on ${this.fieldName} failed. Missing the following permission${
        failedChecks.size > 1 ? 's' : ''
      }: ${[...failedChecks].join(', ')}`,
    );
  }
}
