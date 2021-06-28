import SchemaBuilder from '@giraphql/core';
import ErrorPlugin from '../../src';

export default new SchemaBuilder<{}>({
  plugins: [ErrorPlugin],
  errorOptions: {
    defaultTypes: [Error],
  },
});
