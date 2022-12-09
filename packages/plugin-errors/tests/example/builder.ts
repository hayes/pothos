import SchemaBuilder from '@pothos/core';
import ValidationPlugin from '@pothos/plugin-validation';
import ErrorPlugin from '../../src';

export const builder = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});

export type Builder = typeof builder;

export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errorOptions: {
    defaultTypes: [Error],
    defaultGetTypeName: ({ fieldName, kind }) => `${fieldName}_CUSTOM_NAME_${kind}`,
  },
});
