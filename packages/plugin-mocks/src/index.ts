import './global-types.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver } from 'graphql';
import type { ResolverMap } from './types.js';

const pluginName = 'mocks';

const builtInPrototypes: object[] = [Object.prototype, Function.prototype];

function findDeclaringPrototype(map: object, key: string) {
  for (
    let proto: object | null = Object.getPrototypeOf(map) as object | null;
    proto !== null;
    proto = Object.getPrototypeOf(proto) as object | null
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);

    if (descriptor) {
      return { proto, descriptor };
    }
  }

  return null;
}

function isBuiltInValue(map: object, key: string, value: unknown) {
  const declaration = findDeclaringPrototype(map, key);

  return (
    declaration !== null &&
    builtInPrototypes.includes(declaration.proto) &&
    'value' in declaration.descriptor &&
    declaration.descriptor.value === value
  );
}

function lookupMock<T>(map: Record<string, T> | undefined, key: string): T | undefined {
  if (map === undefined) {
    return undefined;
  }

  const value = map[key];

  if (value === undefined || Object.hasOwn(map, key)) {
    return value;
  }

  return isBuiltInValue(map, key, value) ? undefined : value;
}

export default pluginName;
export class PothosMocksPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const { mocks } = this.options;

    if (!mocks) {
      return resolver;
    }

    return (
      this.resolveMock(fieldConfig.parentType, fieldConfig.name, mocks) ??
      (fieldConfig.declaringType
        ? this.resolveMock(fieldConfig.declaringType, fieldConfig.name, mocks)
        : null) ??
      resolver
    );
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const { mocks } = this.options;

    if (!mocks) {
      return subscribe;
    }

    const subscribeMock = this.subscribeMock(fieldConfig.parentType, fieldConfig.name, mocks);

    return subscribeMock ?? subscribe;
  }

  resolveMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
    const fieldMock = lookupMock(lookupMock(mocks, typename), fieldName) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return fieldMock;
    }

    return fieldMock.resolve || null;
  }

  subscribeMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
    const fieldMock = lookupMock(lookupMock(mocks, typename), fieldName) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return null;
    }

    return fieldMock.subscribe || null;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosMocksPlugin);
