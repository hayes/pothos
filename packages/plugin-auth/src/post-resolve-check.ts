/* eslint-disable babel/no-invalid-this */
import { SchemaTypes, GiraphQLTypeConfig } from '@giraphql/core';
import { PermissionGrantMap } from './types';
import { AuthMeta } from '.';
import { AuthFieldWrapper } from './field-wrapper';
import { ForbiddenError } from './errors';
import ValueOrPromise from './utils/value-or-promise';

export default function runPostResolveChecks<Types extends SchemaTypes>(
  this: AuthFieldWrapper<Types>,
  type: GiraphQLTypeConfig,
  childMeta: AuthMeta,
  parent: unknown,
  context: object,
): ValueOrPromise<null> {
  const postResolveCheckMap = this.resolveChecks.postResolveMap.get(type.name);

  if (!postResolveCheckMap || postResolveCheckMap?.size === 0) {
    return new ValueOrPromise(null);
  }

  const postResolvePromises: ValueOrPromise<{
    name: string;
    result: boolean | PermissionGrantMap;
  }>[] = [];

  for (const [checkTypeName, postResolveCheck] of postResolveCheckMap!) {
    postResolvePromises.push(
      new ValueOrPromise(
        postResolveCheck(
          parent,
          context,
          childMeta.grantedPermissions.permissionsForType(checkTypeName),
        ),
      ).nowOrThen((result) => ({
        name: checkTypeName,
        result,
      })),
    );
  }

  return ValueOrPromise.all(postResolvePromises).nowOrThen((results) => {
    const failedChecks: string[] = [];

    results.forEach(({ name, result }) => {
      if (!result) {
        failedChecks.push(name);
      } else if (typeof result === 'object') {
        childMeta.grantedPermissions.mergeGrants(name, result);
      }
    });

    if (failedChecks.length > 0) {
      const error =
        failedChecks.length === 1
          ? new ForbiddenError(
              `postResolveCheck failed for ${this.fieldName} on ${failedChecks[0]}`,
            )
          : new ForbiddenError(
              `postResolveCheck failed for ${this.fieldName} on ${failedChecks
                .slice(0, -1)
                .join(', ')} and ${failedChecks[failedChecks.length - 1]}`,
            );
      throw error;
    }

    return null;
  });
}
