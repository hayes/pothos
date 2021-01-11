/* eslint-disable babel/no-invalid-this */
import { SchemaTypes } from '@giraphql/core';
import { resolvePermissionCheck } from './utils/resolve-permission-check';
import { evaluateMatcher } from './utils/evaluate-matcher';
import { AuthMeta } from '.';
import { AuthFieldWrapper } from './field-wrapper';
import { ForbiddenError } from './errors';
import ValueOrPromise from './utils/value-or-promise';

export function checkFieldPermissions<Types extends SchemaTypes>(
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

    return null;
  }

  return new ValueOrPromise(resolvePermissionCheck(this.permissionCheck, parent, args, context))
    .nowOrThen((checkResult) => {
      if (typeof checkResult === 'boolean') {
        if (!checkResult) {
          throw new ForbiddenError(`Permission check on ${this.fieldName} failed.`);
        }

        return null;
      }

      const { grantedPermissions, checkCache } = meta;

      const permissionResults = new Map<string, boolean | Promise<boolean>>();

      return evaluateMatcher(checkResult, this.fieldName, (perm) => {
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

          const result = checkCache[perm];

          permissionResults.set(perm, result);

          return result;
        }

        return false;
      }).nowOrThen((failures) => {
        if (failures) {
          const { failedChecks, type } = failures;
          if (type === 'any') {
            throw new ForbiddenError(
              `Permission check on ${this.fieldName} failed. Missing ${
                failedChecks.size > 1
                  ? 'one of the following permissions'
                  : 'the following permission'
              }: ${[...failedChecks].join(', ')})`,
            );
          }
          throw new ForbiddenError(
            `Permission check on ${this.fieldName} failed. Missing the following permission${
              failedChecks.size > 1 ? 's' : ''
            }: ${[...failedChecks].join(', ')}`,
          );
        }
      });
    })
    .toValueOrPromise();
}
