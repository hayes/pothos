import '../../src';
import SchemaBuilder from '@giraphql/core';

export default new SchemaBuilder<{}>({
  plugins: ['validation'],
});
