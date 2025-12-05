import type { PlaygroundExample } from '../types';

export const basicTypesExample: PlaygroundExample = {
  id: 'basic-types',
  title: 'Basic Types',
  description: 'Define object types and queries',
  files: [
    {
      filename: 'schema.ts',
      content: `import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define a simple User type
const User = builder.objectRef<{
  id: string;
  name: string;
  email: string;
}>('User');

builder.objectType(User, {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    email: t.exposeString('email'),
  }),
});

// Define Query type
builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({ required: false }),
      },
      resolve: (_, args) => \`Hello, \${args.name ?? 'World'}!\`,
    }),
    user: t.field({
      type: User,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_, args) => ({
        id: args.id,
        name: 'John Doe',
        email: 'john@example.com',
      }),
    }),
  }),
});

export const schema = builder.toSchema();`,
    },
  ],
  defaultQuery: `query {
  hello(name: "Pothos")
  user(id: "1") {
    id
    name
    email
  }
}`,
};
