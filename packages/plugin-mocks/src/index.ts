import SchemaBuilder, { SchemaTypes, BasePlugin, GiraphQLOutputFieldConfig } from '@giraphql/core';
import { GraphQLFieldResolver } from 'graphql';
import { ResolverMap } from './types';

import './global-types';

export default class MocksPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const { mocks } = buildOptions;

    if (!mocks) {
      return resolver;
    }

    const resolveMock = this.resolveMock(fieldConfig.parentType, fieldConfig.name, mocks);

    return resolveMock || resolver;
  }

  wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const { mocks } = buildOptions;

    if (!mocks) {
      return subscribe;
    }

    const subscribeMock = this.subscribeMock(fieldConfig.parentType, fieldConfig.name, mocks);

    return subscribeMock || subscribe;
  }

  resolveMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
    const fieldMock = mocks[typename]?.[fieldName] || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return fieldMock;
    }

    return fieldMock.resolve || null;
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

SchemaBuilder.registerPlugin('GiraphQLMocks', MocksPlugin);
