import '../../src';
import SchemaBuilder from '@pothos/core';

export default new SchemaBuilder<{
  Scalars: {
    ID: { Input: bigint | number | string; Output: bigint | number | string };
  };
}>({
  plugins: ['zod'],
  zod: {
    validationError: (error) =>
      error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', '),
  },
});
