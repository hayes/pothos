import builder from '../builder';

const ContactInfo = builder.inputType('ContactInfo', {
  fields: (t) => ({
    name: t.string({
      required: true,
      zod: (z) =>
        z.max(30).refine((name) => name[0].toUpperCase() === name[0], 'Name should be capitalized'),
      validate: {
        max: 30,
        refine: {
          check: (name) => name[0].toUpperCase() === name[0],
          message: 'Name should be capitalized',
        },
      },
    }),
    email: t.string({
      required: true,
      zod: (z) =>
        z
          .email()
          .refine((arg) => arg.split('@')[1] !== 'example.com', 'no example.com email addresses'),
      validate: {
        email: true,
        refine: {
          check: (arg) => arg.split('@')[1] !== 'example.com',
          message: 'no example.com email addresses',
        },
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    exampleField: t.int({
      args: {
        odd: t.arg.int({
          zod: (z) => z.max(5, 'max 5!').refine((n) => n % 2 === 1, 'number must be odd'),
          validate: {
            max: { value: 5, message: 'max 5!' },
            refine: {
              check: (n) => n % 2 === 1,
              message: 'number must be odd',
            },
          },
          required: true,
        }),
        contactInfo: t.arg({
          type: ContactInfo,
          zod: (z) =>
            z.refine((info) => info.email.toLocaleLowerCase() === info.email, {
              path: ['email'],
              message: 'email should be lowercase',
            }),
          validate: {
            refine: {
              check: (info) => info.email.toLocaleLowerCase() === info.email,
              path: ['email'],
              message: 'email should be lowercase',
            },
          },
        }),
      },
      resolve(parent, args) {
        return args.odd;
      },
    }),
  }),
});

export default builder.toSchema({});
