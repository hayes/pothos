import './global-types';
import './schema-builder';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  PothosOutputFieldConfig,
  PothosOutputFieldType,
  Resolver,
  SchemaTypes,
} from '@pothos/core';
import { Mock, ResolverMap } from './types';

const pluginName = 'mocks' as const;

export default pluginName;
export class MocksPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const { mocks, typeMocks = [] } = this.options;
    const { parentType: typeName, name: fieldName, type: outputType } = fieldConfig;

    if (!mocks) {
      return resolver;
    }

    const resolveMock = this.resolveMock(typeName, fieldName, outputType, mocks, typeMocks);

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

  resolveMock(
    typeName: string,
    fieldName: string,
    outputType: PothosOutputFieldType<Types>,
    mocks: ResolverMap<Types>,
    typeMocks: Mock<Types>[],
  ): Resolver<unknown, {}, Types['Context'], unknown> | null {
    const fieldMock = mocks[typeName]?.[fieldName] || null;

    if (fieldMock) {
      if (typeof fieldMock === 'function') {
        return fieldMock;
      }

      return fieldMock.resolve ?? null;
    }

    if (outputType.kind === 'Object') {
      const outputName = (outputType.ref as { name: string }).name;
      const mock = typeMocks.find((v) => v.name === outputName);

      return mock?.resolver ?? null;
    }

    if (outputType.kind === 'Interface') {
      const outputName = (outputType.ref as { name: string }).name;
      const implementers = this.builder.configStore
        .getImplementers(outputName)
        .map((implementer) => implementer.name);
      const mock = typeMocks.find((v) => implementers.includes(v.name));

      return mock?.resolver ?? null;
    }

    if (outputType.kind === 'List') {
      const result = this.resolveMock(typeName, fieldName, outputType.type, mocks, typeMocks);
      if (result) {
        return (...args) => [result(...args)];
      }
    }

    return null;
  }

  subscribeMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
    const fieldMock = mocks[typename]?.[fieldName] || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return null;
    }

    return fieldMock.subscribe || null;
  }
}

SchemaBuilder.registerPlugin(pluginName, MocksPlugin);
