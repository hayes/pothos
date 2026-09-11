import SchemaBuilder from '@pothos/core';
import ZodPlugin from '@pothos/plugin-zod';
import type { ZodError } from 'zod';
// #region setup
const builder = new SchemaBuilder({
  plugins: [ZodPlugin],
  zod: {
    validationError: (error: ZodError) => error.issues.map((issue) => issue.message).join('; '),
  },
});
let emails: string[] = [];
// #endregion setup
builder.queryType({ fields: (t) => ({ savedEmails: t.stringList({ resolve: () => emails }) }) });
// #region roster
builder.mutationType({
  fields: (t) => ({
    setRoster: t.stringList({
      args: {
        emails: t.arg.stringList({
          required: true,
          validate: {
            maxLength: [2, { message: 'Roster is too large' }],
            items: { email: [true, { message: 'Enter a valid email' }] },
          },
        }),
      },
      resolve: (_, args) => {
        emails = args.emails;
        return emails;
      },
    }),
  }),
});
// #endregion roster
export const schema = builder.toSchema();
