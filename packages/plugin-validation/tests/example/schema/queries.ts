import * as zod from 'zod';
import builder from '../builder';
import {
  AsyncChainedInput,
  ChainedTransformInput,
  InputFieldTransformTest,
  NestedObjectListInput,
  SoloNestedInput,
  WithSchemaInput,
  WithValidationInput,
} from './input-types';
import { ContactInfo, Enum1Type, Recursive } from './types';

// Basic query fields with argument validation
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
          email: zod.string().optional(),
          phone: zod.string().optional(),
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
          email: zod.string().optional(),
          phone: zod.string().optional(),
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

    // Complex field with multiple validation patterns
    exampleField: t.int({
      args: {
        enum1: t.arg({
          type: [Enum1Type],
          validate: zod.array(zod.unknown()).refine((val) => val[0] === 0), // Enum1.One = 0
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
        }),
      },
      validate: zod
        .object({
          enum1: zod.unknown().optional(),
          recursive: zod.unknown(),
          odd: zod.unknown(),
          contactInfo: zod
            .object({
              name: zod.string().optional(),
              aliases: zod.array(zod.string()).optional(),
              email: zod.string().optional(),
              phone: zod.string().optional(),
            })
            .optional(),
        })
        .refine((args) => (args.contactInfo?.aliases?.length ?? 0) >= 2, {
          path: ['contactInfo', 'aliases'],
          message: 'contactInfo should include at least 2 aliases',
        }),
      resolve(_parent, args) {
        return args.odd;
      },
    }),

    // Field with args-level schema validation
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

// Query fields that use input types
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

builder.queryField('withSchemaInput', (t) =>
  t.boolean({
    nullable: true,
    args: {
      input: t.arg({ type: WithSchemaInput }),
    },
    resolve: () => true,
  }),
);

// Chaining API examples with argument transformations
builder.queryField('chainedArgTransforms', (t) =>
  t.string({
    args: {
      // Transform string to number
      numericId: t.arg.string({ required: true }).validate(
        zod
          .string()
          .regex(/^\d+$/)
          .transform((str) => Number.parseInt(str, 10))
          .refine((num) => num > 0, 'ID must be positive'),
      ),

      // Transform with multiple validations
      price: t.arg
        .string({ required: true })
        .validate(
          zod
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format')
            .transform((str) => Number.parseFloat(str)),
        )
        .validate(
          zod.number().min(0.01, 'Price must be at least $0.01').max(999999.99, 'Price too high'),
        )
        .validate(
          zod
            .number()
            .transform((price) => Math.round(price * 100)), // Convert to cents
        ),

      // Transform string to boolean with validation
      isActive: t.arg
        .string({ required: true })
        .validate(
          zod
            .enum(['true', 'false', '1', '0', 'yes', 'no'])
            .transform((val) => ['true', '1', 'yes'].includes(val.toLowerCase())),
        ),

      // Transform comma-separated string to array
      tags: t.arg.string({ required: true }).validate(
        zod
          .string()
          .transform((str) => str.split(',').map((s) => s.trim()))
          .refine((tags) => tags.length > 0, 'At least one tag required')
          .transform((tags) => [...new Set(tags)]), // Remove duplicates
      ),

      // Optional with default transformation
      limit: t.arg.int({ required: false }).validate(
        zod
          .number()
          .optional()
          .transform((val) => val ?? 10)
          .refine((val) => val <= 100, 'Limit cannot exceed 100'),
      ),
    },
    resolve: (_parent, args) => {
      // All args are now transformed to their proper types
      return JSON.stringify({
        numericId: args.numericId, // number
        priceInCents: args.price, // number (in cents)
        isActive: args.isActive, // boolean
        tags: args.tags, // string[]
        limit: args.limit, // number (with default)
      });
    },
  }),
);

// Async validation with chaining
builder.queryField('asyncChainedValidation', (t) =>
  t.boolean({
    nullable: true,
    args: {
      // Async username validation
      username: t.arg.string().validate(
        zod
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_]+$/)
          .refine(async (username) => {
            // Simulate database check
            await new Promise((resolve) => setTimeout(resolve, 10));
            return !['admin', 'root', 'test'].includes(username.toLowerCase());
          }, 'Username is taken')
          .transform((username) => username.toLowerCase()),
      ),

      // Multiple async validations chained
      email: t.arg
        .string()
        .validate(zod.string().email())
        .validate(
          zod.string().refine(async (email) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return !email.endsWith('@disposable.com');
          }, 'Disposable emails not allowed'),
        )
        .validate(zod.string().transform((email) => email.toLowerCase())),
    },
    resolve: () => true,
  }),
);

// Args validation with t.validate and chaining
builder.queryField('argsWithChaining', (t) =>
  t.boolean({
    nullable: true,
    args: t.validate(
      {
        // Individual field with chained validation
        startTime: t.arg.string().validate(
          zod
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .transform((time) => {
              const [hours, minutes] = time.split(':').map(Number);
              return hours * 60 + minutes; // Convert to minutes
            }),
        ),
        endTime: t.arg.string().validate(
          zod
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .transform((time) => {
              const [hours, minutes] = time.split(':').map(Number);
              return hours * 60 + minutes; // Convert to minutes
            }),
        ),
        // Field with options validation
        dayOfWeek: t.arg.int({
          validate: zod.number().min(0).max(6),
        }),
      },
      // Overall validation on transformed data
      zod
        .object({
          startTime: zod.number(),
          endTime: zod.number(),
          dayOfWeek: zod.number(),
        })
        .refine((data) => data.endTime > data.startTime, 'End time must be after start time'),
    ),
    resolve: () => true,
  }),
);

// Simple t.validate() with cross-field validation
builder.queryField('calculateDiscount', (t) =>
  t.string({
    args: t.validate(
      {
        price: t.arg.float({ required: true }),
        discountType: t.arg.string({ required: true }),
        discountValue: t.arg.float({ required: true }),
      },
      zod
        .object({
          price: zod.number().positive(),
          discountType: zod.enum(['percentage', 'fixed']),
          discountValue: zod.number().positive(),
        })
        .refine((data) => {
          if (data.discountType === 'percentage') {
            return data.discountValue <= 100;
          }
          return data.discountValue <= data.price;
        }, 'Discount cannot exceed price or 100% for percentage discounts'),
    ),
    resolve: (_parent, args) => {
      const { price, discountType, discountValue } = args;
      const discount =
        discountType === 'percentage' ? (price * discountValue) / 100 : discountValue;
      const final = price - discount;
      return `Original: $${price}, Discount: $${discount}, Final: $${final}`;
    },
  }),
);

// t.validate() with field transformations
builder.queryField('convertTemperature', (t) =>
  t.float({
    args: t.validate(
      {
        value: t.arg.float({ required: true }),
        unit: t.arg.string({ required: true }),
      },
      zod
        .object({
          value: zod.number(),
          unit: zod.enum(['C', 'F']),
        })
        .refine((data) => {
          // Check for absolute zero limits
          if (data.unit === 'C' && data.value < -273.15) {
            return false;
          }
          if (data.unit === 'F' && data.value < -459.67) {
            return false;
          }

          return true;
        }, 'Temperature cannot be below absolute zero'),
    ),
    resolve: (_parent, args) => {
      const { value, unit } = args;
      // Convert to Fahrenheit
      return unit === 'C' ? (value * 9) / 5 + 32 : value;
    },
  }),
);

// t.validate() combining with field-level validation
builder.queryField('advancedUserInput', (t) =>
  t.string({
    args: t.validate(
      {
        email: t.arg.string({ required: true }).validate(
          zod
            .string()
            .email()
            .transform((email) => email.toLowerCase()),
        ),
        age: t.arg.int({ required: true }).validate(zod.number().min(18, 'Must be 18 or older')),
      },
      zod
        .object({
          email: zod.string().email(),
          age: zod.number(),
        })
        .refine((data) => !data.email.includes('test'), 'Test emails not allowed'),
    ),
    resolve: (_parent, args) => {
      return `User ${args.email}, age ${args.age}`;
    },
  }),
);

// Query fields for input types with chaining transformations
builder.queryField('chainedTransformInput', (t) =>
  t.string({
    args: {
      input: t.arg({ type: ChainedTransformInput }),
    },
    resolve: (_parent, args) => {
      // Input fields have been transformed:
      // numericString: string -> number
      // dateString: string -> Date
      // uniqueTags: string[] -> Set<string>
      // jsonConfig: string -> { enabled: boolean, level: number }
      // nullableScore: number | null -> number (with default 0)
      return JSON.stringify({
        numericString: args.input?.numericString,
        dateString: args.input?.dateString?.toISOString(),
        uniqueTags: Array.from(args.input?.uniqueTags || []),
        jsonConfig: args.input?.jsonConfig,
        nullableScore: args.input?.nullableScore,
      });
    },
  }),
);

builder.queryField('asyncChainedInput', (t) =>
  t.string({
    args: {
      input: t.arg({ type: AsyncChainedInput }),
    },
    resolve: (_parent, args) => {
      // Username and email have gone through async validation and transformation
      return JSON.stringify({
        username: args.input?.username, // lowercase
        email: args.input?.email, // validated and lowercase
      });
    },
  }),
);

builder.queryField('inputFieldTransformTest', (t) =>
  t.int({
    args: {
      input: t.arg({ type: InputFieldTransformTest }),
    },
    resolve: (_parent, args) => {
      return args.input?.counter ?? 0;
    },
  }),
);
