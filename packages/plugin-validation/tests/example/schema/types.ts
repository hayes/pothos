import * as zod from 'zod';
import builder from '../builder';

// Recursive type for complex validation patterns
interface RecursiveShape {
  number: number;
  recurse?: RecursiveShape;
}

export const Recursive = builder.inputRef<RecursiveShape>('Recursive');

Recursive.implement({
  validate: zod.object({
    number: zod.number().refine((n) => n !== 3, { message: 'number must not be 3' }),
  }),
  fields: (t) => ({
    number: t.int({
      required: true,
      validate: zod.number().max(5),
    }),
    float: t.float({
      required: true,
      validate: zod.number().refine((val) => val % 1 !== 0),
    }),
    recurse: t.field({
      required: false,
      type: Recursive,
    }),
  }),
});

// Enum for validation testing
enum Enum1 {
  One = 0,
  Two = 1,
  Three = 2,
}

export const Enum1Type = builder.enumType(Enum1, {
  name: 'Enum1',
});

// Contact info input type with complex validations
export const ContactInfo = builder.inputType('ContactInfo', {
  fields: (t) => ({
    name: t.string({
      required: true,
      validate: zod
        .string()
        .max(30)
        .refine(async (name) => Promise.resolve(name[0].toUpperCase() === name[0]), {
          message: 'Name should be capitalized',
        }),
    }),
    aliases: t.stringList({
      validate: zod.array(
        zod
          .string()
          .max(30)
          .refine((alias) => alias[0].toUpperCase() === alias[0], {
            message: 'Aliases should be capitalized',
          }),
      ),
    }),
    email: t.string({
      required: true,
      validate: zod
        .string()
        .email()
        .refine((arg) => arg.split('@')[1] !== 'example.com', {
          message: 'no example.com email addresses',
        }),
    }),
    phone: t.string({
      validate: zod
        .string()
        .trim()
        .regex(/^\d{3}-\d{3}-\d{4}$/u),
    }),
  }),
});
