import * as zod from 'zod';
import builder from '../builder';

// Input type with object-level validation
export const WithValidationInput = builder.inputType('WithValidationInput', {
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

// Simple nested input
export const NestedInput = builder.inputType('NestedInput', {
  fields: (t) => ({ id: t.id() }),
});

// Input with nested field validation
export const SoloNestedInput = builder.inputType('SoloNestedInput', {
  fields: (t) => ({
    nested: t.field({
      required: true,
      type: NestedInput,
      validate: zod.object({ id: zod.string().min(2) }),
    }),
  }),
});

// Input with array of nested objects
export const NestedObjectListInput = builder.inputType('NestedObjectListInput', {
  fields: (t) => ({
    nested: t.field({
      required: true,
      type: [NestedInput],
      validate: zod.array(zod.object({ id: zod.string().min(2) })),
    }),
  }),
});

// Input with schema-level validation
export const WithSchemaInput = builder.inputType('WithSchemaInput', {
  fields: (t) => ({
    name: t.string(),
  }),
  validate: zod.object({ name: zod.string().min(2) }),
});

// Input demonstrating field-level chaining with type transformations
export const ChainedTransformInput = builder.inputType('ChainedTransformInput', {
  fields: (t) => ({
    // Transform string to number
    numericString: t.string({ required: true }).validate(
      zod
        .string()
        .regex(/^\d+$/, 'Must be numeric')
        .transform((val) => Number.parseInt(val, 10))
        .refine((num) => num > 0, 'Must be positive'),
    ),

    // Transform string to Date with async validation
    dateString: t.string({ required: true }).validate(
      zod
        .string()
        .datetime()
        .transform((str) => new Date(str))
        .refine(async (date) => {
          // Simulate async check (e.g., checking against a database)
          await new Promise((resolve) => setTimeout(resolve, 10));
          return date > new Date('2020-01-01');
        }, 'Date must be after 2020'),
    ),

    // Transform string array to Set with multiple validations
    uniqueTags: t
      .stringList({ required: true })
      .validate(zod.array(zod.string()).transform((arr) => new Set(arr)))
      .validate(zod.set(zod.string()).refine((set) => set.size >= 2, 'Need at least 2 unique tags'))
      .validate(zod.set(zod.string()).refine((set) => !set.has(''), 'Empty tags not allowed')),

    // Transform and validate JSON string to object
    jsonConfig: t
      .string({ required: true })
      .validate(
        zod.string().transform((str) => {
          try {
            return JSON.parse(str);
          } catch {
            throw new Error('Invalid JSON');
          }
        }),
      )
      .validate(
        zod.object({
          enabled: zod.boolean(),
          level: zod.number().min(1).max(10),
        }),
      ),

    // Optional field with transformation
    nullableScore: t
      .float({ required: false })
      .validate(
        zod
          .number()
          .optional()
          .transform((val) => val ?? 0),
      )
      .validate(zod.number().min(0).max(100)),
  }),
});

// Input demonstrating async transformations and validations
export const AsyncChainedInput = builder.inputType('AsyncChainedInput', {
  fields: (t) => ({
    // Async validation followed by transformation
    username: t.string({ required: true }).validate(
      zod
        .string()
        .min(3)
        .refine(async (username) => {
          // Simulate checking username availability
          await new Promise((resolve) => setTimeout(resolve, 10));
          return !['admin', 'root', 'system'].includes(username.toLowerCase());
        }, 'Username is reserved')
        .transform((username) => username.toLowerCase()),
    ),

    // Multiple async validations
    email: t
      .string({ required: true })
      .validate(zod.string().email())
      .validate(
        zod.string().refine(async (email) => {
          // Simulate checking if email is not in blocklist
          await new Promise((resolve) => setTimeout(resolve, 10));
          return !email.endsWith('@temp-mail.com');
        }, 'Temporary email addresses not allowed'),
      )
      .validate(
        zod.string().refine(async (email) => {
          // Simulate checking if email domain exists
          await new Promise((resolve) => setTimeout(resolve, 10));
          return email.includes('@');
        }, 'Invalid email domain'),
      )
      .validate(zod.string().transform((email) => email.toLowerCase())),
  }),
});
