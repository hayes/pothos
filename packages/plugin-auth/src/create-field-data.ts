import {
  SchemaTypes,
  GiraphQLInterfaceTypeConfig,
  GiraphQLUnionTypeConfig,
  GiraphQLTypeConfig,
  GiraphQLOutputFieldConfig,
} from '@giraphql/core';

import {
  PreResolveCheck,
  PostResolveCheck,
  ResolveChecksForType,
  AuthPluginOptions,
  PermissionCheckMap,
  PermissionCheck,
} from './types';

function mergeMap<K, V>(left: Map<K, V>, right: Map<K, V>) {
  for (const [key, value] of right) {
    left.set(key, value);
  }

  return left;
}

function getObjectChecks<Types extends SchemaTypes>(
  type: Extract<GiraphQLTypeConfig, { graphqlKind: 'Object' }>,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
) {
  const preResolveMap = new Map<string, PreResolveCheck<any>>();
  const postResolveMap = new Map<string, PostResolveCheck<any, unknown>>();

  if (type.kind === 'Query' || type.kind === 'Mutation' || type.kind === 'Subscription') {
    return { preResolveMap, postResolveMap };
  }

  const options = type.giraphqlOptions;
  if (options.preResolveCheck) {
    preResolveMap.set(type.name, options.preResolveCheck);
  }

  if (options.postResolveCheck) {
    postResolveMap.set(type.name, options.postResolveCheck);
  }

  type.interfaces.forEach((interfaceRef) => {
    const interfaceConfig = builder.configStore.getTypeConfig(interfaceRef, 'Interface');
    const interfaceOptions = interfaceConfig.giraphqlOptions;

    if (interfaceOptions.preResolveCheck) {
      preResolveMap.set(interfaceConfig.name, interfaceOptions.preResolveCheck);
    }

    const interfacePostResolveCheck = interfaceOptions.postResolveCheck;

    if (interfacePostResolveCheck) {
      postResolveMap.set(interfaceConfig.name, (parent, context, grantedPermissions) =>
        interfacePostResolveCheck(type.name, parent, context, grantedPermissions),
      );
    }
  });

  return { preResolveMap, postResolveMap };
}

function getInterfaceChecks<Types extends SchemaTypes>(
  type: GiraphQLInterfaceTypeConfig,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  options: Required<AuthPluginOptions>,
): ResolveChecksForType {
  const preResolveMap = new Map<string, PreResolveCheck<any>>();
  const postResolveMap = new Map<string, Map<string, PostResolveCheck<any, unknown>>>();

  const implementers = builder.configStore.getImplementers(type.name);
  const interfaceOptions = type.giraphqlOptions;

  implementers.forEach((implementer) => {
    const implementerChecks = getObjectChecks(implementer, builder);

    if (!options.skipPreResolveOnInterfaces && !interfaceOptions.skipImplementorPreResolveChecks) {
      mergeMap(preResolveMap, implementerChecks.preResolveMap);
    }

    postResolveMap.set(implementer.name, implementerChecks.postResolveMap);
  });

  if (interfaceOptions.preResolveCheck) {
    preResolveMap.set(type.name, interfaceOptions.preResolveCheck);
  }

  return { preResolveMap, postResolveMap };
}

function getUnionChecks<Types extends SchemaTypes>(
  type: GiraphQLUnionTypeConfig,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  options: Required<AuthPluginOptions>,
): ResolveChecksForType {
  const preResolveMap = new Map<string, PreResolveCheck<any>>();
  const postResolveMap = new Map<string, Map<string, PostResolveCheck<any, unknown>>>();
  const unionOptions = type.giraphqlOptions;
  const { postResolveCheck } = unionOptions;

  if (unionOptions.preResolveCheck) {
    preResolveMap.set(type.name, unionOptions.preResolveCheck);
  }

  type.types.forEach((member) => {
    const memberConfig = builder.configStore.getTypeConfig(member, 'Object');
    const memberChecks = getObjectChecks(memberConfig, builder);

    if (!options.skipPreResolveOnUnions && !unionOptions.skipMemberPreResolveChecks) {
      mergeMap(preResolveMap, memberChecks.preResolveMap);
    }

    if (postResolveCheck) {
      postResolveMap.set(
        memberConfig.name,
        mergeMap(
          new Map([
            [
              type.name,
              (parent, context, perms) => postResolveCheck(member.name, parent, context, perms),
            ],
          ]),
          memberChecks.postResolveMap,
        ),
      );
    } else {
      postResolveMap.set(memberConfig.name, memberChecks.postResolveMap);
    }
  });

  return {
    preResolveMap,
    postResolveMap,
    grantAsShared: type.name,
  };
}

export function getResolveChecks<Types extends SchemaTypes>(
  typename: string,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  options: Required<AuthPluginOptions>,
): ResolveChecksForType {
  const typeConfig = builder.configStore.getTypeConfig(typename);

  if (typeConfig.graphqlKind === 'Object') {
    const objectChecks = getObjectChecks(typeConfig, builder);

    return {
      preResolveMap: objectChecks.preResolveMap,
      postResolveMap: new Map([[typename, objectChecks.postResolveMap]]),
    };
  }

  if (typeConfig.graphqlKind === 'Interface') {
    return getInterfaceChecks(typeConfig, builder, options);
  }

  if (typeConfig.graphqlKind === 'Union') {
    return getUnionChecks(typeConfig, builder, options);
  }

  return { preResolveMap: new Map(), postResolveMap: new Map() };
}

export function getPermissionCheckers<Types extends SchemaTypes>(
  field: GiraphQLOutputFieldConfig<Types>,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
) {
  const typeConfig = builder.configStore.getTypeConfig(field.parentType);

  if (typeConfig.graphqlKind !== 'Object') {
    return {};
  }

  return (typeConfig.giraphqlOptions.permissions as PermissionCheckMap<Types, unknown>) ?? {};
}

export function getPermissionCheck<Types extends SchemaTypes>(
  field: GiraphQLOutputFieldConfig<Types>,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  options: Required<AuthPluginOptions>,
) {
  const typeConfig = builder.configStore.getTypeConfig(field.parentType);

  const defaultPermissionCheck =
    typeConfig.graphqlKind === 'Object'
      ? typeConfig.giraphqlOptions.defaultPermissionCheck
      : undefined;

  const permissionCheck = field.giraphqlOptions.permissionCheck || defaultPermissionCheck;

  if (
    options.explicitMutationChecks &&
    field.parentType === 'Mutation' &&
    (!field.giraphqlOptions.permissionCheck ||
      (Array.isArray(field.giraphqlOptions.permissionCheck) &&
        field.giraphqlOptions.permissionCheck.length === 0))
  ) {
    throw new Error(
      `${field.name} is missing an explicit permission check which is required for all Mutations (explicitMutationChecks)`,
    );
  }

  return (permissionCheck as PermissionCheck<Types, unknown, {}>) || [];
}
