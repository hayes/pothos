import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Query type demonstrating various argument types
builder.queryType({
  fields: (t) => ({
    // Scalar arguments using convenience methods
    withArgs: t.stringList({
      args: {
        id: t.arg.id(),
        int: t.arg.int(),
        float: t.arg.float(),
        boolean: t.arg.boolean(),
        string: t.arg.string(),
        idList: t.arg.idList(),
        intList: t.arg.intList(),
        floatList: t.arg.floatList(),
        booleanList: t.arg.booleanList(),
        stringList: t.arg.stringList(),
      },
      resolve: (_root, args) => Object.keys(args),
    }),

    // Required vs optional arguments
    nullableArgs: t.stringList({
      args: {
        optional: t.arg.string(),
        required: t.arg.string({ required: true }),
        requiredList: t.arg.stringList({ required: true }),
        sparseList: t.arg.stringList({
          required: {
            list: true,
            items: false,
          },
        }),
      },
      resolve: (_parent, args) => Object.keys(args),
    }),

    // List arguments
    giraffeNameChecker: t.booleanList({
      args: {
        names: t.arg.stringList({ required: true }),
      },
      resolve: (_parent, args) => {
        return args.names.map((name) => ['Gina', 'James'].includes(name));
      },
    }),
  }),
});

export const schema = builder.toSchema();
