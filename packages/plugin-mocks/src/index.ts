import './global-types.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver } from 'graphql';
import type { ResolverMap } from './types.js';

const pluginName = 'mocks';

function getOwn<T>(map: Record<string, T> | undefined, key: string): T | undefined {
  return map !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;
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
    const fieldMock = getOwn(getOwn(mocks, typename), fieldName) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return fieldMock;
    }

    return fieldMock.resolve || null;
  }

  subscribeMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
    const fieldMock = getOwn(getOwn(mocks, typename), fieldName) || null;

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
