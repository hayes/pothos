import {
  BuildCache,
  getObjectOptions,
  getInterfaceOptions,
  getUnionOptions,
  getOutputFieldOptions,
  getOutputTypeWithFieldOptions,
} from '@giraphql/core';
import {
  GraphQLFieldConfig,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLType,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLUnionType,
} from 'graphql';
import {
  PreResolveCheck,
  PermissionCheck,
  PostResolveCheck,
  AuthFieldData,
  ResolveChecksForType,
} from './types';
import AuthPlugin from '.';

function mergeMap<K, V>(left: Map<K, V>, right: Map<K, V>) {
  for (const [key, value] of right) {
    left.set(key, value);
  }

  return left;
}

function unwrapType(type: GraphQLType): GraphQLNamedType {
  if (type instanceof GraphQLNonNull) {
    return unwrapType(type.ofType);
  }

  if (type instanceof GraphQLList) {
    return unwrapType(type.ofType);
  }

  return type;
}

function getObjectChecks(type: GraphQLObjectType, cache: BuildCache<any>) {
  const preResolveMap = new Map<GraphQLNamedType, PreResolveCheck<any>>();
  const postResolveMap = new Map<GraphQLNamedType, PostResolveCheck<any, unknown>>();

  const options = getObjectOptions(type);

  if (options.preResolveCheck) {
    preResolveMap.set(type, options.preResolveCheck);
  }

  if (options.postResolveCheck) {
    postResolveMap.set(type, options.postResolveCheck);
  }

  type.getInterfaces().forEach((interfaceType) => {
    const interfaceOptions = getInterfaceOptions(interfaceType);

    if (interfaceOptions.preResolveCheck) {
      preResolveMap.set(interfaceType, interfaceOptions.preResolveCheck);
    }

    const interfacePostResolveCheck = interfaceOptions.postResolveCheck;

    if (interfacePostResolveCheck) {
      postResolveMap.set(interfaceType, (parent, context, grantedPermissions) =>
        interfacePostResolveCheck(type.name, parent, context, grantedPermissions),
      );
    }
  });

  return { preResolveMap, postResolveMap };
}

function getInterfaceChecks(
  type: GraphQLInterfaceType,
  cache: BuildCache<any>,
  plugin: AuthPlugin,
): ResolveChecksForType {
  const preResolveMap = new Map<GraphQLNamedType, PreResolveCheck<any>>();
  const postResolveMap = new Map<
    GraphQLNamedType,
    Map<GraphQLNamedType, PostResolveCheck<any, unknown>>
  >();

  const implementers = cache.getImplementers(type);

  const interfaceOptions = getInterfaceOptions(type);

  implementers.forEach((implementer) => {
    const implementerChecks = getObjectChecks(implementer, cache);

    if (!plugin.skipPreResolveOnInterfaces && !interfaceOptions.skipImplementorPreResolveChecks) {
      mergeMap(preResolveMap, implementerChecks.preResolveMap);
    }

    postResolveMap.set(implementer, implementerChecks.postResolveMap);
  });

  if (interfaceOptions.preResolveCheck) {
    preResolveMap.set(type, interfaceOptions.preResolveCheck);
  }

  return { preResolveMap, postResolveMap };
}

function getUnionChecks(
  type: GraphQLUnionType,
  cache: BuildCache<any>,
  plugin: AuthPlugin,
): ResolveChecksForType {
  const preResolveMap = new Map<GraphQLNamedType, PreResolveCheck<any>>();
  const postResolveMap = new Map<
    GraphQLNamedType,
    Map<GraphQLNamedType, PostResolveCheck<any, unknown>>
  >();
  const options = getUnionOptions(type);
  const { postResolveCheck } = options;

  if (options.preResolveCheck) {
    preResolveMap.set(type, options.preResolveCheck);
  }

  type.getTypes().forEach((member) => {
    const memberChecks = getObjectChecks(member, cache);

    if (!plugin.skipPreResolveOnUnions && !options.skipMemberPreResolveChecks) {
      mergeMap(preResolveMap, memberChecks.preResolveMap);
    }

    if (postResolveCheck) {
      postResolveMap.set(
        member,
        mergeMap(
          new Map([
            [
              type,
              (parent, context, perms) => postResolveCheck(member.name, parent, context, perms),
            ],
          ]),
          memberChecks.postResolveMap,
        ),
      );
    } else {
      postResolveMap.set(member, memberChecks.postResolveMap);
    }
  });

  return {
    preResolveMap,
    postResolveMap,
    grantAsShared: type.name,
  };
}

function getChecks(
  type: GraphQLNamedType,
  cache: BuildCache<any>,
  plugin: AuthPlugin,
): ResolveChecksForType {
  if (type instanceof GraphQLObjectType) {
    const objectChecks = getObjectChecks(type, cache);

    return {
      preResolveMap: objectChecks.preResolveMap,
      postResolveMap: new Map([[type, objectChecks.postResolveMap]]),
    };
  }

  if (type instanceof GraphQLInterfaceType) {
    return getInterfaceChecks(type, cache, plugin);
  }

  if (type instanceof GraphQLUnionType) {
    return getUnionChecks(type, cache, plugin);
  }

  return { preResolveMap: new Map(), postResolveMap: new Map() };
}

export function createFieldData(
  parentType: GraphQLObjectType | GraphQLInterfaceType,
  name: string,
  config: GraphQLFieldConfig<unknown, object>,
  cache: BuildCache<any>,
  plugin: AuthPlugin,
): AuthFieldData {
  const returnType = unwrapType(config.type);
  const typeOptions = getOutputTypeWithFieldOptions(parentType);
  const fieldOptions = getOutputFieldOptions(parentType, config, name);

  const permissionCheck: PermissionCheck<any, any, any> =
    fieldOptions.permissionCheck || typeOptions.defaultPermissionCheck || [];

  const permissionCheckers: {
    [s: string]: (parent: unknown, context: {}) => boolean | Promise<boolean>;
  } =
    parentType instanceof GraphQLObjectType
      ? (typeOptions as GiraphQLSchemaTypes.ObjectTypeOptions).permissions ?? {}
      : {};

  const fieldName = `${parentType.name}.${name}`;

  if (
    plugin.explicitMutationChecks &&
    parentType.name === 'Mutation' &&
    (!fieldOptions.permissionCheck ||
      (Array.isArray(fieldOptions.permissionCheck) && fieldOptions.permissionCheck.length === 0))
  ) {
    throw new Error(
      `${fieldName} is missing an explicit permission check which is required for all Mutations (explicitMutationChecks)`,
    );
  }

  const grantPermissions = fieldOptions.grantPermissions || null;

  const resolveChecks = getChecks(returnType, cache, plugin);

  return {
    resolveChecks,
    unwrappedReturnType: returnType,
    returnType: config.type,
    parentType,
    fieldName,
    permissionCheck,
    permissionCheckers,
    grantPermissions,
  };
}
