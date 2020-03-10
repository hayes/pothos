import { ForbiddenError } from 'apollo-server';
import AuthPlugin, { GrantMap } from '.';
import { PermissionGrantMap } from './types';

export default async function runPreResolveChecks(
  data: GiraphQLSchemaTypes.FieldWrapData,
  context: object,
  plugin: AuthPlugin,
) {
  const { resolveChecks, fieldName } = data.giraphqlAuth;
  const preResolveCheckMap = resolveChecks.preResolveMap;

  const newGrants = new GrantMap();

  if (preResolveCheckMap?.size !== 0) {
    if (!plugin.preResolveAuthCheckCache.has(context)) {
      plugin.preResolveAuthCheckCache.set(context, new Map());
    }
    const preResolveCache = plugin.preResolveAuthCheckCache.get(context)!;

    const preResolvePromises: Promise<{
      name: string;
      result: boolean | PermissionGrantMap;
    }>[] = [];

    for (const [name, preResolveCheck] of preResolveCheckMap!) {
      if (!preResolveCache.has(preResolveCheck)) {
        preResolveCache.set(preResolveCheck, preResolveCheck(context));
      }

      preResolvePromises.push(
        Promise.resolve(preResolveCache.get(preResolveCheck)!).then(result => ({ name, result })),
      );
    }

    const results = await Promise.all(preResolvePromises);
    const failedChecks: string[] = [];

    results.forEach(({ name, result }) => {
      if (!result) {
        failedChecks.push(name);
      } else if (typeof result === 'object') {
        if (name === resolveChecks.grantAsShared) {
          newGrants.mergeSharedGrants(result);
        } else {
          newGrants.mergeGrants(name, result);
        }
      }
    });

    if (failedChecks.length !== 0) {
      if (failedChecks.length === 1) {
        throw new ForbiddenError(`preResolveCheck failed for ${fieldName} on ${failedChecks[0]}`);
      } else {
        throw new ForbiddenError(
          `preResolveChecks failed for ${fieldName} on ${failedChecks
            .slice(0, -1)
            .join(', ')} and ${failedChecks[failedChecks.length - 1]}`,
        );
      }
    }
  }

  return newGrants;
}
