/* eslint-disable babel/no-invalid-this */
import { SchemaTypes } from '@giraphql/core';
import { GrantMap } from '.';
import { PermissionGrantMap, AuthRequestData } from './types';
import { AuthFieldWrapper } from './field-wrapper';
import { ForbiddenError } from './errors';
import ValueOrPromise from './utils/then';

export default function runPreResolveChecks<Types extends SchemaTypes>(
  this: AuthFieldWrapper<Types>,
  requestData: AuthRequestData,
  context: object,
): ValueOrPromise<GrantMap> {
  const preResolveCheckMap = this.resolveChecks.preResolveMap;

  const newGrants = new GrantMap();

  if (preResolveCheckMap?.size === 0) {
    return new ValueOrPromise(newGrants);
  }
  const preResolveCache = requestData.preResolveAuthCheckCache;

  const preResolvePromises: ValueOrPromise<{
    name: string;
    result: boolean | PermissionGrantMap;
  }>[] = [];

  for (const [typeName, preResolveCheck] of preResolveCheckMap!) {
    if (!preResolveCache.has(preResolveCheck)) {
      preResolveCache.set(preResolveCheck, new ValueOrPromise(preResolveCheck(context)));
    }

    preResolvePromises.push(
      preResolveCache.get(preResolveCheck)!.nowOrThen((result) => ({
        name: typeName,
        result,
      })),
    );
  }

  return ValueOrPromise.all(preResolvePromises).nowOrThen((results) => {
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

    if (failedChecks.length > 0) {
      const error =
        failedChecks.length === 1
          ? new ForbiddenError(`preResolveCheck failed for ${this.fieldName} on ${failedChecks[0]}`)
          : new ForbiddenError(
              `preResolveChecks failed for ${this.fieldName} on ${failedChecks
                .slice(0, -1)
                .join(', ')} and ${failedChecks[failedChecks.length - 1]}`,
            );
      throw error;
    }

    return newGrants;
  });
}
