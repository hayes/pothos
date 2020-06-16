import { ResolveValueWrapper } from '@giraphql/core/src';
import { ForbiddenError } from 'apollo-server';
import { GraphQLNamedType } from 'graphql';
import { PermissionGrantMap } from './types';

export default async function runPostResolveChecks(
  type: GraphQLNamedType,
  data: GiraphQLSchemaTypes.FieldWrapData,
  parent: ResolveValueWrapper,
  context: object,
) {
  const grants = parent.data.giraphqlAuth!.grantedPermissions;
  const { resolveChecks, fieldName } = data.giraphqlAuth;
  const postResolveCheckMap = resolveChecks.postResolveMap.get(type);

  if (postResolveCheckMap && postResolveCheckMap?.size !== 0) {
    const postResolvePromises: Promise<{
      name: string;
      result: boolean | PermissionGrantMap;
    }>[] = [];

    for (const [checkType, postResolveCheck] of postResolveCheckMap!) {
      postResolvePromises.push(
        Promise.resolve(
          postResolveCheck(parent.value, context, grants.permissionsForType(checkType.name)),
        ).then((result) => ({
          name: checkType.name,
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
