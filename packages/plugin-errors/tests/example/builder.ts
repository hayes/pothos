import SchemaBuilder from '@giraphql/core';
import ValidationPlugin from '@giraphql/plugin-validation';
import ErrorPlugin from '../../src';

export default new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});
