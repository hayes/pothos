import { ResolveValueWrapper } from '@giraphql/core/src';
import { ForbiddenError } from 'apollo-server';
import { PermissionGrantMap } from './types';

export default async function runPostResolveChecks(
  typename: string,
  data: GiraphQLSchemaTypes.FieldWrapData,
  parent: ResolveValueWrapper,
  context: object,
) {
  const grants = parent.data.giraphqlAuth!.grantedPermissions;
  const { resolveChecks, fieldName } = data.giraphqlAuth;
  const postResolveCheckMap = resolveChecks.postResolveMap.get(typename);

  if (postResolveCheckMap && postResolveCheckMap?.size !== 0) {
    const postResolvePromises: Promise<{
      name: string;
      result: boolean | PermissionGrantMap;
    }>[] = [];

    for (const [name, postResolveCheck] of postResolveCheckMap!) {
      postResolvePromises.push(
        Promise.resolve(
          postResolveCheck(parent.value, context, grants.permissionsForType(name)),
        ).then(result => ({
          name,
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
        grants.mergeGrants(name, result);
      }
    });

    if (failedChecks.length !== 0) {
      if (failedChecks.length === 1) {
        throw new ForbiddenError(`postResolveCheck failed for ${fieldName} on ${failedChecks[0]}`);
      } else {
        throw new ForbiddenError(
          `postResolveCheck failed for ${fieldName} on ${failedChecks
            .slice(0, -1)
            .join(', ')} and ${failedChecks[failedChecks.length - 1]}`,
        );
      }
    }
  }
}
