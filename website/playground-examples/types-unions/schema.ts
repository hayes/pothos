// #region definition
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

const GiraffeStringFactRef = builder
  .objectRef<{ factKind: 'string'; fact: string }>('GiraffeStringFact')
  .implement({
    fields: (t) => ({
      fact: t.exposeString('fact'),
    }),
  });

const GiraffeNumericFactRef = builder
  .objectRef<{ factKind: 'number'; fact: string; value: number }>('GiraffeNumericFact')
  .implement({
    fields: (t) => ({
      fact: t.exposeString('fact'),
      value: t.exposeFloat('value'),
    }),
  });

const GiraffeFactRef = builder.unionType('GiraffeFact', {
  types: [GiraffeStringFactRef, GiraffeNumericFactRef],
  resolveType: (fact) => {
    switch (fact.factKind) {
      case 'string':
        return GiraffeStringFactRef;
      case 'number':
        return GiraffeNumericFactRef;
    }
  },
});
// #endregion definition

// #region query
const facts: (typeof GiraffeFactRef.$inferType)[] = [
  {
    factKind: 'string',
    fact: 'Each giraffe has a unique pattern of spots.',
  },
  {
    factKind: 'number',
    fact: 'Top speed (MPH)',
    value: 35,
  },
];

builder.queryType({
  fields: (t) => ({
    giraffeFacts: t.field({
      type: [GiraffeFactRef],
      resolve: () => facts,
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion query
