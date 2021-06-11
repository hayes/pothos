import builder from './builder';

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

const GiraffeFact = builder.unionType('GiraffeFact', {
  types: ['GiraffeStringFact', GiraffeNumericFact],
  resolveType: (fact) => {
    switch (fact.factKind) {
      case 'number':
        return GiraffeNumericFact;
      case 'string':
        return 'GiraffeStringFact';
      default:
        return null;
    }
  },
});

builder.queryField('giraffeFacts', (t) =>
  t.field({
    type: [GiraffeFact],
    resolve: () => {
      const fact1 = {
        factKind: 'string',
        fact: 'A giraffe’s spots are much like human fingerprints. No two individual giraffes have exactly the same pattern',
      } as const;

      const fact2 = {
        factKind: 'number',
        fact: 'Top speed (MPH)',
        value: 35,
      } as const;

      return [fact1, fact2];
    },
  }),
);
