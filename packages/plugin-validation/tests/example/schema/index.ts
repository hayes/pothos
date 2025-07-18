import * as zod from 'zod';
import builder from '../builder';

interface RecursiveShape {
  number: number;
  recurse?: RecursiveShape;
}
const Recursive = builder.inputRef<RecursiveShape>('Recursive');

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

enum Enum1 {
  One = 0,
  Two = 1,
  Three = 2,
}

const Enum1Type = builder.enumType(Enum1, {
  name: 'Enum1',
});

const ContactInfo = builder.inputType('ContactInfo', {
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

builder.queryType({
  fields: (t) => ({
    simple: t.boolean({
      nullable: true,
      args: {
        email: t.arg.string({
          validate: zod.string().email(),
        }),
        phone: t.arg.string({
          validate: zod.string().trim(),
        }),
      },
      validate: zod
        .object({
          email: zod.string(),
          phone: zod.string(),
        })
        .refine((args) => Promise.resolve(!!args.phone || !!args.email)),
      resolve: () => true,
    }),
    withMessage: t.boolean({
      nullable: true,
      args: {
        email: t.arg.string({
          validate: zod.string().email({
            message: 'invalid email address',
          }),
        }),
        phone: t.arg.string({
          validate: zod.string().trim(),
        }),
      },
      validate: zod
        .object({
          email: zod.string(),
          phone: zod.string(),
        })
        .refine((args) => !!args.phone || !!args.email, {
          message: 'Must provide either phone number or email address',
        }),
      resolve: () => true,
    }),
    list: t.boolean({
      nullable: true,
      args: {
        list: t.arg.stringList({
          validate: zod.array(zod.string().max(3)).max(3),
        }),
      },
      resolve: () => true,
    }),
    exampleField: t.int({
      args: {
        enum1: t.arg({
          type: [Enum1Type],
          validate: zod.array(zod.unknown()).refine((val) => val[0] === Enum1.One),
        }),
        recursive: t.arg({
          type: Recursive,
          required: true,
        }),
        odd: t.arg.int({
          validate: zod
            .number()
            .max(5)
            .refine((n) => n % 2 === 1, {
              message: 'number must be odd',
            }),
          required: true,
        }),
        contactInfo: t.arg({
          type: ContactInfo,
          validate: zod
            .object({
              email: zod.string().email(),
            })
            .refine((info) => info.email.toLocaleLowerCase() === info.email, {
              message: 'email should be lowercase',
              path: ['email'],
            }),
        }),
      },
      validate: zod
        .object({
          enum1: zod.unknown(),
          recursive: zod.unknown(),
          odd: zod.unknown(),
          contactInfo: zod.object({
            aliases: zod.array(zod.string()),
          }),
        })
        .refine((args) => (args.contactInfo?.aliases?.length ?? 0) > 1, {
          path: ['contactInfo', 'aliases'],
          message: 'contactInfo should include at least 2 aliases',
        }),
      resolve(_parent, args) {
        return args.odd;
      },
    }),
    all: t.boolean({
      description: 'all possible validations, (these constraints cant be satisfied',
      args: {
        number: t.arg.float({
          validate: zod
            .number()
            .positive()
            .negative()
            .nonnegative()
            .nonpositive()
            .int()
            .min(5)
            .max(5)
            .refine(() => true),
        }),
        bigint: t.arg.id({
          validate: zod.bigint().refine(() => true),
        }),
        string: t.arg.string({
          validate: zod
            .string()
            .email()
            .url()
            .uuid()
            .regex(/abc/u)
            .length(5)
            .max(5)
            .min(5)
            .refine(() => true),
        }),
        object: t.arg({
          required: false,
          type: Recursive,
          validate: zod
            .object({
              recurse: zod.object({}),
            })
            .refine((obj) => !obj.recurse),
        }),
        array: t.arg.stringList({
          validate: zod
            .array(zod.string().max(5))
            .length(5)
            .refine(() => true),
        }),
      },
      resolve: () => true,
    }),
    argsSchema: t.boolean({
      nullable: true,
      args: {
        num: t.arg.int(),
        string: t.arg.string(),
      },
      validate: zod.object({ num: zod.number().min(2), string: zod.string().min(2) }),
      resolve: () => true,
    }),
  }),
});

const WithValidationInput = builder.inputType('WithValidationInput', {
  fields: (t) => ({
    name: t.string(),
    age: t.int(),
  }),
  validate: zod
    .object({
      name: zod.string(),
      age: zod.number(),
    })
    .refine((args) => args.name === 'secret', { message: 'Incorrect name given' })
    .refine((args) => args.age === 100, { message: 'Incorrect age given' }),
});
const WithValidationAndFieldValidator = builder.inputType('WithValidationAndFieldValidator', {
  fields: (t) => ({
    name: t.string(),
    age: t.int(),
  }),
  validate: zod
    .object({
      name: zod.string(),
      age: zod.number(),
    })
    .refine((args) => args.name === 'secret', { message: 'Incorrect name given' })
    .refine((args) => args.age === 100, { message: 'Incorrect age given' }),
});

const NestedInput = builder.inputType('NestedInput', {
  fields: (t) => ({ id: t.id() }),
});

const SoloNestedInput = builder.inputType('SoloNestedInput', {
  fields: (t) => ({
    nested: t.field({
      required: true,
      type: NestedInput,
      validate: zod.object({ id: zod.string().min(2) }),
    }),
  }),
});

const NestedObjectListInput = builder.inputType('NestedObjectListInput', {
  fields: (t) => ({
    nested: t.field({
      required: true,
      type: [NestedInput],
      validate: zod.array(zod.object({ id: zod.string().min(2) })),
    }),
  }),
});

const WithSchemaInput = builder.inputType('WithSchemaInput', {
  fields: (t) => ({
    name: t.string(),
  }),
  validate: zod.object({ name: zod.string().min(2) }),
});

builder.queryField('soloNested', (t) =>
  t.boolean({
    nullable: true,
    args: {
      input: t.arg({ type: SoloNestedInput }),
    },
    resolve: () => true,
  }),
);

builder.queryField('nestedObjectList', (t) =>
  t.boolean({
    nullable: true,
    args: {
      input: t.arg({ type: NestedObjectListInput }),
    },
    resolve: () => true,
  }),
);

builder.queryField('withValidationInput', (t) =>
  t.boolean({
    nullable: true,
    args: {
      input: t.arg({ type: WithValidationInput }),
    },
    resolve: () => true,
  }),
);

builder.queryField('withValidationAndFieldValidator', (t) =>
  t.boolean({
    nullable: true,
    args: {
      input: t.arg({ type: WithValidationAndFieldValidator }),
    },
    resolve: () => true,
  }),
);

builder.queryField('withSchemaInput', (t) =>
  t.boolean({
    nullable: true,
    args: {
      input: t.arg({ type: WithSchemaInput }),
    },
    resolve: () => true,
  }),
);

builder.queryField('withSchemaInputList', (t) =>
  t.boolean({
    nullable: true,
    args: {
      input: t.arg({ type: [WithSchemaInput] }),
    },
    resolve: () => true,
  }),
);

export default builder.toSchema();
