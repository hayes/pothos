import builder from '../builder';

builder.queryType({
  directives: {
    o: {
      foo: 123,
    },
  },
  fields: (t) => ({
    test: t.string({
      directives: [
        {
          name: 'f',
          args: {
            foo: 123,
          },
        },
      ],
      args: {
        arg1: t.arg.string({
          directives: {
            a: { foo: 123 },
          },
        }),
      },
      resolve: () => 'hi',
    }),
  }),
});

builder.objectRef<{}>('Obj').implement({
  directives: {
    o: { foo: 123 },
  },
  fields: () => ({}),
});

builder.interfaceRef<{}>('IF').implement({
  directives: {
    i: { foo: 123 },
  },
});

builder.inputRef<{}>('In').implement({
  directives: {
    io: { foo: 123 },
  },
  fields: (t) => ({
    test: t.string({
      directives: { if: { foo: 123 } },
    }),
  }),
});

builder.unionType('UN', {
  directives: {
    u: { foo: 123 },
  },
  resolveType: () => {
    throw new Error('Not implemented');
  },
  types: [],
});

builder.enumType('EN', {
  directives: {
    e: { foo: 123 },
  },
  values: {
    ONE: {
      value: 1,
      directives: {
        ev: { foo: 123 },
      },
    },
  },
});

builder.scalarType('Date', {
  directives: {
    s: { foo: 123 },
  },
  serialize: () => new Date(),
});

export default builder.toSchema({});
