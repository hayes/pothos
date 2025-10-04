import SchemaBuilder from '@pothos/core';
import ValidationPlugin from '@pothos/plugin-validation';
import ErrorPlugin from '../../src';

export const builder = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errors: {
    defaultTypes: [Error],
    unsafelyHandleInputErrors: true,
  },
});

export type Builder = typeof builder;

export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errors: {
    defaultTypes: [Error],
    defaultResultOptions: {
      name: ({ fieldName }) => `${capitalize(fieldName)}_CUSTOM_RESULT_NAME`,
    },
    defaultUnionOptions: {
      name: ({ fieldName }) => `${capitalize(fieldName)}_CUSTOM_UNION_NAME`,
    },
    defaultItemResultOptions: {
      name: ({ fieldName }) => `${capitalize(fieldName)}_CUSTOM_ITEM_RESULT_NAME`,
    },
    defaultItemUnionOptions: {
      name: ({ fieldName }) => `${capitalize(fieldName)}_CUSTOM_ITEM_UNION_NAME`,
    },
  },
});

function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
