import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define a simple Giraffe type
const Giraffe = builder.objectRef<{ name: string }>('Giraffe');

Giraffe.implement({
  fields: (t) => ({
    name: t.exposeString('name'),
  }),
});

// In-memory storage for demonstration
const giraffes: Array<{ name: string }> = [];

// Define Query type with multiple fields
builder.queryType({
  fields: (t) => ({
    // Add query for a simple scalar type
    hello: t.string({
      resolve: () => 'hello, world!',
    }),
    // Add a query for an object type
    giraffe: t.field({
      type: Giraffe,
      resolve: () => ({
        name: 'James',
      }),
    }),
    // Add a query for a list of objects
    giraffes: t.field({
      type: [Giraffe],
      resolve: () => (giraffes.length > 0 ? giraffes : [{ name: 'James' }]),
    }),
  }),
});

// Mock services for demonstration
const messageClient = {
  postMessage: (message: string) => {
    console.log('Posted message:', message);
    return true;
  },
};

const db = {
  giraffes: {
    create: (giraffe: { name: string }) => {
      giraffes.push(giraffe);
    },
  },
};

// Define Mutation type
builder.mutationType({
  fields: (t) => ({
    // Add mutation that returns a simple boolean
    post: t.boolean({
      args: {
        message: t.arg.string({ required: true }),
      },
      resolve: async (_root, args) => {
        // Do something with the message
        const success = await messageClient.postMessage(args.message);

        return success;
      },
    }),
  }),
});

builder.mutationField('createGiraffe', (t) =>
  t.field({
    type: Giraffe,
    args: {
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      const giraffe = {
        name: args.name,
      };

      await db.giraffes.create(giraffe);

      return giraffe;
    },
  }),
);

export const schema = builder.toSchema();
