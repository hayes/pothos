import '../../src';
import SchemaBuilder from '@pothos/core';

export default new SchemaBuilder<{
  Scalars: {
    ID: { Input: bigint | number | string; Output: bigint | number | string };
  };
}>({
  plugins: ['validation'],
  validation: {},
});
