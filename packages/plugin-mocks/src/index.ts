import './global-types.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver } from 'graphql';
import type { ResolverMap } from './types.js';

const pluginName = 'mocks';

// Values inherited from these prototypes are never mocks, they are built-in members that happen to
// share a name with a type or field (`toString`, `constructor`, `call`, ...).
const builtInPrototypes: object[] = [Object.prototype, Function.prototype];

function isBuiltInMember(map: object, key: string) {
  for (
    let proto: object | null = Object.getPrototypeOf(map) as object | null;
    proto !== null;
    proto = Object.getPrototypeOf(proto) as object | null
  ) {
    if (Object.hasOwn(proto, key)) {
      return builtInPrototypes.includes(proto);
    }
  }

  return false;
}

// Looks a key up in a user provided mock map. Values the map provides itself are used as is, even
// when they come from a prototype or a Proxy, but built-in members are ignored so that types and
// fields the user never mocked keep their original resolvers.
function lookupMock<T>(map: Record<string, T> | undefined, key: string): T | undefined {
  if (map === undefined) {
    return undefined;
  }

  const value = map[key];

  if (value === undefined || Object.hasOwn(map, key)) {
    return value;
  }

  return isBuiltInMember(map, key) ? undefined : value;
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

    const resolveMock = this.resolveMock(fieldConfig.parentType, fieldConfig.name, mocks);

    // Fields defined on an interface are shared by every type that implements it, so mocks for the
    // concrete object type can only be resolved when the field is executed.
    if (fieldConfig.graphqlKind === 'Interface') {
      return (parent, args, context, info) => {
        const mock =
          info.parentType.name === fieldConfig.parentType
            ? resolveMock
            : (this.resolveMock(info.parentType.name, fieldConfig.name, mocks) ?? resolveMock);

        return (mock ?? resolver)(parent, args, context, info);
      };
    }

    return resolveMock ?? resolver;
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
