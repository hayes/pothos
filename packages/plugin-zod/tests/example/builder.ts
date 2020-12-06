import SchemaBuilder from '@giraphql/core';
import '../../src';

export default new SchemaBuilder<{}>({
  plugins: ['GiraphQLZod'],
});
