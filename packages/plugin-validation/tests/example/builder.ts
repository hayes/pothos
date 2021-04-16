import '../../src';
import SchemaBuilder from '@giraphql/core';

export default new SchemaBuilder<{
  Scalars: {
    ID: { Input: bigint | number | string; Output: bigint | number | string };
  };
}>({
  plugins: ['validation'],
});
