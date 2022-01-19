import SchemaBuilder from '@pothos/core';
import ValidationPlugin from '@pothos/plugin-validation';
import ErrorPlugin from '../../src';

export default new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});
