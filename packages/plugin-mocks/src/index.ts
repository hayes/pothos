import SchemaBuilder, { SchemaTypes, BasePlugin, GiraphQLOutputFieldConfig } from '@giraphql/core';
import { ResolverMap } from './types';
import { MocksFieldWrapper } from './field-wrapper';

import './global-types';

export default class MocksPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  wrapOutputField(
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ) {
    const { mocks } = buildOptions;

    if (!mocks) {
      return null;
    }

    const resolveMock = this.resolveMock(fieldConfig.parentType, fieldConfig.name, mocks);
    const subscribeMock = this.subscribeMock(fieldConfig.parentType, fieldConfig.name, mocks);

    if (resolveMock || subscribeMock) {
      return new MocksFieldWrapper(fieldConfig, resolveMock, subscribeMock);
    }

    return null;
  }

  resolveMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
    const fieldMock = (mocks[typename] && mocks[typename][fieldName]) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return fieldMock;
    }

    return fieldMock.resolve || null;
  }

  subscribeMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
    const fieldMock = (mocks[typename] && mocks[typename][fieldName]) || null;

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
