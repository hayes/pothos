import SchemaBuilder from '@giraphql/core';
import ErrorPlugin from '@giraphql/plugin-errors';
import ValidationPlugin from '@giraphql/plugin-validation';

export default new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});
