import SchemaBuilder from '@pothos/core';
import ValidationPlugin from '@pothos/plugin-validation';
import { z } from 'zod';

const builder = new SchemaBuilder({
  plugins: [ValidationPlugin],
});

// Mock user store
const users: Array<{ email: string; name: string }> = [];

builder.queryType({
  fields: (t) => ({
    // Simple argument validation
    simple: t.boolean({
      args: {
        // Validate individual arguments
        email: t.arg.string({
          validate: z.string().email(),
        }),
      },
      resolve: () => true,
    }),
    // Multiple argument validation
    user: t.string({
      args: {
        email: t.arg.string({
          validate: z.string().email(),
        }),
        name: t.arg.string({
          validate: z.string().min(2).max(50),
        }),
      },
      resolve: (_, args) => `User: ${args.name}`,
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createUser: t.field({
      type: 'String',
      args: {
        email: t.arg.string({
          required: true,
          validate: z.string().email(),
        }),
        name: t.arg.string({
          required: true,
          validate: z.string().min(2).max(50),
        }),
      },
      resolve: (_, args) => {
        users.push({ email: args.email, name: args.name });
        return `Created user ${args.name}`;
      },
    }),
  }),
});

export const schema = builder.toSchema();
