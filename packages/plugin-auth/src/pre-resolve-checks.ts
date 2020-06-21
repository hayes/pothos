import { SchemaTypes } from '@giraphql/core';
import { ForbiddenError } from 'apollo-server';
import { GrantMap } from '.';
import { PermissionGrantMap, AuthRequestData } from './types';
import { AuthFieldWrapper } from './field-wrapper';

export default async function runPreResolveChecks<Types extends SchemaTypes>(
  this: AuthFieldWrapper<Types>,
  requestData: AuthRequestData,
  context: object,
): Promise<GrantMap> {
  const preResolveCheckMap = this.resolveChecks.preResolveMap;

  const newGrants = new GrantMap();

  if (preResolveCheckMap?.size !== 0) {
    const preResolveCache = requestData.preResolveAuthCheckCache;

    const preResolvePromises: Promise<{
      name: string;
      result: boolean | PermissionGrantMap;
    }>[] = [];

    for (const [typeName, preResolveCheck] of preResolveCheckMap!) {
      if (!preResolveCache.has(preResolveCheck)) {
        preResolveCache.set(preResolveCheck, preResolveCheck(context));
      }

      preResolvePromises.push(
        Promise.resolve(preResolveCache.get(preResolveCheck)!).then((result) => ({
          name: typeName,
          result,
        })),
      );
    }

    const results = await Promise.all(preResolvePromises);
    const failedChecks: string[] = [];

    results.forEach(({ name, result }) => {
      if (!result) {
        failedChecks.push(name);
      } else if (typeof result === 'object') {
        if (name === this.resolveChecks.grantAsShared) {
          newGrants.mergeSharedGrants(result);
        } else {
          newGrants.mergeGrants(name, result);
        }
      }
    });

    if (failedChecks.length !== 0) {
      if (failedChecks.length === 1) {
        throw new ForbiddenError(
          `preResolveCheck failed for ${this.fieldName} on ${failedChecks[0]}`,
        );
      } else {
        throw new ForbiddenError(
          `preResolveChecks failed for ${this.fieldName} on ${failedChecks
            .slice(0, -1)
            .join(', ')} and ${failedChecks[failedChecks.length - 1]}`,
        );
      }
    }
  }

  return newGrants;
}
