import SchemaBuilder from '@pothos/core';
import './required-typename-plugin';

export const builder = new SchemaBuilder<{
  Scalars: {
    ID: { Input: string; Output: string };
  };
}>({});
