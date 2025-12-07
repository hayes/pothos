import SchemaBuilder from '@pothos/core';

interface WithIdField {
  id: string;
}

interface SchemaTypes {
  Objects: {
    WithCommonFields1: WithIdField;
    WithCommonFields2: WithIdField;
  };
}

const builder = new SchemaBuilder<SchemaTypes>({});

// Simple approach: Use object type directly
const WithCommonFields1 = builder.objectType('WithCommonFields1', {
  fields: (t) => ({
    id: t.exposeID('id', {}),
    idLength: t.int({
      resolve: (parent) => parent.id.length,
    }),
  }),
});

const WithCommonFields2 = builder.objectType('WithCommonFields2', {
  fields: (t) => ({
    id: t.exposeID('id', {}),
    idLength: t.int({
      resolve: (parent) => parent.id.length,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    object1: t.field({
      type: WithCommonFields1,
      resolve: () => ({ id: 'abc123' }),
    }),
    object2: t.field({
      type: WithCommonFields2,
      resolve: () => ({ id: 'xyz789' }),
    }),
  }),
});

export const schema = builder.toSchema();
