import * as z from 'zod';
import builder from '../builder';

builder.queryType({
  fields: (t) => ({
    requiresOddArg: t.int({
      args: {
        odd: t.arg.int({
          required: true,
        }),
      },
      zodSchema: z.object({ odd: z.number().refine((arg) => arg % 2 !== 0, 'Number is not odd') }),
      resolve(parent, args) {
        return args.odd;
      },
    }),
  }),
});

export default builder.toSchema({});
