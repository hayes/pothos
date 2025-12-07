import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder<{
  Objects: {
    GiraffeStringFact: { factKind: 'string'; fact: string };
    GiraffeNumericFact: { factKind: 'number'; fact: string; value: number };
  };
}>({});

// Define object types for union members
builder.objectType('GiraffeStringFact', {
  fields: (t) => ({
    fact: t.exposeString('fact', {}),
  }),
});

const GiraffeNumericFact = builder.objectType('GiraffeNumericFact', {
  fields: (t) => ({
    fact: t.exposeString('fact', {}),
    value: t.exposeFloat('value', {}),
  }),
});

// Define union type
const GiraffeFact = builder.unionType('GiraffeFact', {
  types: ['GiraffeStringFact', GiraffeNumericFact],
  resolveType: (fact) => {
    switch (fact.factKind) {
      case 'number':
        return GiraffeNumericFact;
      case 'string':
        return 'GiraffeStringFact';
    }
  },
});

// Query that returns union type
builder.queryType({
  fields: (t) => ({
    giraffeFacts: t.field({
      type: [GiraffeFact],
      resolve: () => {
        const fact1 = {
          factKind: 'string' as const,
          fact: "A giraffe's spots are much like human fingerprints. No two individual giraffes have exactly the same pattern",
        };

        const fact2 = {
          factKind: 'number' as const,
          fact: 'Top speed (MPH)',
          value: 35,
        };

        return [fact1, fact2];
      },
    }),
  }),
});

export const schema = builder.toSchema();
