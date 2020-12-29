/* eslint-disable babel/no-invalid-this */
import { SchemaTypes, GiraphQLTypeConfig } from '@giraphql/core';
import { PermissionGrantMap } from './types';
import { AuthMeta } from '.';
import { AuthFieldWrapper } from './field-wrapper';
import { ForbiddenError } from './errors';

export default async function runPostResolveChecks<Types extends SchemaTypes>(
  this: AuthFieldWrapper<Types>,
  type: GiraphQLTypeConfig,
  childMeta: AuthMeta,
  parent: unknown,
  context: object,
) {
  const postResolveCheckMap = this.resolveChecks.postResolveMap.get(type.name);

  if (postResolveCheckMap && postResolveCheckMap?.size !== 0) {
    const postResolvePromises: Promise<{
      name: string;
      result: boolean | PermissionGrantMap;
    }>[] = [];

    for (const [checkTypeName, postResolveCheck] of postResolveCheckMap!) {
      postResolvePromises.push(
        Promise.resolve(
          postResolveCheck(
            parent,
            context,
            childMeta.grantedPermissions.permissionsForType(checkTypeName),
          ),
        ).then((result) => ({
          name: checkTypeName,
          result,
        })),
      );
    }

    const results = await Promise.all(postResolvePromises);
    const failedChecks: string[] = [];

    results.forEach(({ name, result }) => {
      if (!result) {
        failedChecks.push(name);
      } else if (typeof result === 'object') {
        childMeta.grantedPermissions.mergeGrants(name, result);
      }
    });

    if (failedChecks.length > 0) {
      const error = failedChecks.length === 1 ? new ForbiddenError(
          `postResolveCheck failed for ${this.fieldName} on ${failedChecks[0]}`,
        ) : new ForbiddenError(
          `postResolveCheck failed for ${this.fieldName} on ${failedChecks
            .slice(0, -1)
            .join(', ')} and ${failedChecks[failedChecks.length - 1]}`,
        );
      throw error;
    }
  }
}
