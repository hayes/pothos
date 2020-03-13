import {
  BaseType,
  TypeParam,
  Field,
  BuildCache,
  ObjectType,
  InterfaceType,
  UnionType,
  ImplementedType,
} from '@giraphql/core';
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

function getObjectChecks(type: ObjectType<any>, cache: BuildCache) {
  const preResolveMap = new Map<string, PreResolveCheck<any>>();
  const postResolveMap = new Map<string, PostResolveCheck<any, unknown>>();

  if (type.options.preResolveCheck) {
    preResolveMap.set(type.typename, type.options.preResolveCheck);
  }

  if (type.options.postResolveCheck) {
    postResolveMap.set(type.typename, type.options.postResolveCheck);
  }

  type.interfaces.forEach(name => {
    const interfaceType = cache.getEntryOfType(name, 'Interface').type;

    if (interfaceType.options.preResolveCheck) {
      preResolveMap.set(interfaceType.typename, interfaceType.options.preResolveCheck);
    }

    const interfacePostResolveCheck = interfaceType.options.postResolveCheck;

    if (interfacePostResolveCheck) {
      postResolveMap.set(interfaceType.typename, (parent, context, grantedPermissions) =>
        interfacePostResolveCheck(type.typename, parent, context, grantedPermissions),
      );
    }
  });

  return { preResolveMap, postResolveMap };
}

function getInterfaceChecks(
  type: InterfaceType<any, any>,
  cache: BuildCache,
  plugin: AuthPlugin,
): ResolveChecksForType {
  const preResolveMap = new Map<string, PreResolveCheck<any>>();
  const postResolveMap = new Map<string, Map<string, PostResolveCheck<any, unknown>>>();

  const implementers = cache.getImplementers(type.typename);

  implementers.forEach(implementer => {
    const implementerChecks = getObjectChecks(implementer, cache);

    if (!plugin.skipPreResolveOnInterfaces && !type.options.skipImplementorPreResolveChecks) {
      mergeMap(preResolveMap, implementerChecks.preResolveMap);
    }

    postResolveMap.set(implementer.typename, implementerChecks.postResolveMap);
  });

  if (type.options.preResolveCheck) {
    preResolveMap.set(type.typename, type.options.preResolveCheck);
  }

  return { preResolveMap, postResolveMap };
}

function getUnionChecks(
  type: UnionType<any, any>,
  cache: BuildCache,
  plugin: AuthPlugin,
): ResolveChecksForType {
  const preResolveMap = new Map<string, PreResolveCheck<any>>();
  const postResolveMap = new Map<string, Map<string, PostResolveCheck<any, unknown>>>();
  const { postResolveCheck } = type.options;

  if (type.options.preResolveCheck) {
    preResolveMap.set(type.typename, type.options.preResolveCheck);
  }

  const members = type.members.map(member => cache.getEntryOfType(member, 'Object').type);
  members.forEach(member => {
    const memberChecks = getObjectChecks(member, cache);

    if (!plugin.skipPreResolveOnUnions && !type.options.skipMemberPreResolveChecks) {
      mergeMap(preResolveMap, memberChecks.preResolveMap);
    }

    if (postResolveCheck) {
      postResolveMap.set(
        member.typename,
        mergeMap(
          new Map([
            [
              type.typename,
              (parent, context, perms) => postResolveCheck(member.typename, parent, context, perms),
            ],
          ]),
          memberChecks.postResolveMap,
        ),
      );
    } else {
      postResolveMap.set(member.typename, memberChecks.postResolveMap);
    }
  });

  return {
    preResolveMap,
    postResolveMap,
    grantAsShared: type.typename,
  };
}

function getChecks(
  type: ImplementedType,
  cache: BuildCache,
  plugin: AuthPlugin,
): ResolveChecksForType {
  if (type.kind === 'Object') {
    const objectChecks = getObjectChecks(type, cache);

    return {
      preResolveMap: objectChecks.preResolveMap,
      postResolveMap: new Map([[type.typename, objectChecks.postResolveMap]]),
    };
  }

  if (type.kind === 'Interface') {
    return getInterfaceChecks(type, cache, plugin);
  }

  if (type.kind === 'Union') {
    return getUnionChecks(type, cache, plugin);
  }

  return { preResolveMap: new Map(), postResolveMap: new Map() };
}

export function createFieldData(
  name: string,
  field: Field<{}, any, TypeParam<any>>,
  cache: BuildCache,
  plugin: AuthPlugin,
): AuthFieldData {
  const parentType = cache.getType(field.parentTypename);
  const fieldParentTypename = field.parentTypename;
  const nonListReturnType = Array.isArray(field.type) ? field.type[0] : field.type;
  const returnTypename =
    typeof nonListReturnType === 'string'
      ? nonListReturnType
      : (nonListReturnType as BaseType).typename;
  const returnType = cache.getType(returnTypename);

  const permissionCheck: PermissionCheck<any, any, any> =
    field.options.permissionCheck ||
    ((parentType.kind === 'Object' || parentType.kind === 'Interface') &&
      parentType.options.defaultPermissionCheck) ||
    [];

  const permissionCheckers: {
    [s: string]: (parent: unknown, context: {}) => boolean | Promise<boolean>;
  } =
    parentType.kind === 'Object' ||
    parentType.kind === 'Query' ||
    parentType.kind === 'Mutation' ||
    parentType.kind === 'Subscription'
      ? parentType.options.permissions ?? {}
      : {};

  const fieldName = `${field.parentTypename}.${name}`;

  if (
    plugin.explicitMutationChecks &&
    field.parentTypename === 'Mutation' &&
    (!field.options.permissionCheck ||
      (Array.isArray(field.options.permissionCheck) && field.options.permissionCheck.length === 0))
  ) {
    throw new Error(
      `${fieldName} is missing an explicit permission check which is required for all Mutations (explicitMutationChecks)`,
    );
  }

  const grantPermissions = field.options.grantPermissions || null;

  const resolveChecks = getChecks(returnType, cache, plugin);

  return {
    resolveChecks,
    returnTypename,
    fieldParentTypename,
    fieldName,
    permissionCheck,
    permissionCheckers,
    grantPermissions,
  };
}
