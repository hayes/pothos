import SchemaBuilder from '@pothos/core';
import ValidationPlugin from '@pothos/plugin-validation';
import ErrorPlugin from '../../src';

export const builder = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errors: {
    defaultTypes: [Error],
  },
});

export type Builder = typeof builder;

export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errors: {
    defaultTypes: [Error],
    defaultResultOptions: {
      name: ({ fieldName }) => `${fieldName}_CUSTOM_RESULT_NAME`,
    },
    defaultUnionOptions: {
      name: ({ fieldName }) => `${fieldName}_CUSTOM_UNION_NAME`,
    },
  },
});
