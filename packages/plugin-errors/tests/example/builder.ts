import SchemaBuilder from '@giraphql/core';
import ErrorPlugin from '@giraphql/plugin-errors';

export default new SchemaBuilder<{}>({
  plugins: [ErrorPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});
