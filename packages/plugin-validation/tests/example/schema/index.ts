import builder from '../builder';

interface RecursiveShape {
  number: number;
  recurse?: RecursiveShape;
}
const Recursive = builder.inputRef<RecursiveShape>('Recursive');

Recursive.implement({
  fields: (t) => ({
    number: t.int({
      required: true,
      validate: {
        max: 5,
      },
    }),
    float: t.float({
      required: true,
      validate: (val) => val % 1 !== 0,
    }),
    recurse: t.field({
      required: false,
      type: Recursive,
    }),
  }),
});

enum Enum1 {
  One,
  Two,
  Three,
}

const Enum1Type = builder.enumType(Enum1, {
  name: 'Enum1',
});

const ContactInfo = builder.inputType('ContactInfo', {
  fields: (t) => ({
    name: t.string({
      required: true,
      validate: {
        maxLength: 30,
        refine: [
          (name) => name[0].toUpperCase() === name[0],
          { message: 'Name should be capitalized' },
        ],
      },
    }),
    aliases: t.stringList({
      validate: {
        items: {
          maxLength: 30,
        },
        refine: [
          (list) => list.every((alias) => alias[0].toUpperCase() === alias[0]),
          { message: 'Aliases should be capitalized' },
        ],
      },
    }),
    email: t.string({
      required: true,
      validate: {
        email: true,
        refine: [
          (arg) => arg.split('@')[1] !== 'example.com',
          { message: 'no example.com email addresses' },
        ],
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    exampleField: t.int({
      args: {
        enum1: t.arg({
          type: [Enum1Type],
          validate: {
            refine: (val) => val[0] === Enum1.One,
          },
        }),
        recursive: t.arg({
          type: Recursive,
          required: true,
        }),
        odd: t.arg.int({
          validate: {
            max: 5,
            refine: [(n) => n % 2 === 1, { message: 'number must be odd' }],
          },
          required: true,
        }),
        contactInfo: t.arg({
          type: ContactInfo,
          validate: {
            refine: [
              [
                (info) => info.email.toLocaleLowerCase() === info.email,
                {
                  path: ['email'],
                  message: 'email should be lowercase',
                },
              ],
            ],
          },
        }),
      },
      validate: {
        refine: [
          (args) => (args.contactInfo?.aliases?.length || 0) > 1,
          {
            path: ['contactInfo', 'aliases'],
            message: 'contactInfo should include at least 2 aliases',
          },
        ],
      },
      resolve(parent, args) {
        return args.odd;
      },
    }),
  }),
});

export default builder.toSchema({});
