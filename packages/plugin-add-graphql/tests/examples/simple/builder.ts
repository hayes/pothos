import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '../../../src';

interface Types {
  Context: {};
  Scalars: {
    ID: {
      Input: string;
      Output: number | string;
    };
  };
}

export default new SchemaBuilder<Types>({
  plugins: [AddGraphQLPlugin],
});
