import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import ValidationPlugin, {
  InputValidationError,
  type StandardSchemaV1,
} from '@pothos/plugin-validation';
import { z } from 'zod';

// #region setup
// This public example deliberately exposes validation details before authorization.
const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin, ValidationPlugin],
  errors: { unsafelyHandleInputErrors: true },
});
const names: string[] = [];
// #endregion setup
// #region issues
const Issue = builder.objectRef<StandardSchemaV1.Issue>('ValidationIssue').implement({
  fields: (t) => ({
    message: t.exposeString('message'),
    path: t.stringList({
      resolve: (issue) =>
        issue.path?.map((part) => String(typeof part === 'object' ? part.key : part)) ?? [],
    }),
  }),
});
builder.objectType(InputValidationError, {
  name: 'InputValidationError',
  fields: (t) => ({ issues: t.field({ type: [Issue], resolve: (error) => error.issues }) }),
});
// #endregion issues
builder.queryType({ fields: (t) => ({ savedNames: t.stringList({ resolve: () => names }) }) });
// #region mutation
const Registration = builder.inputType('Registration', {
  fields: (t) => ({
    name: t
      .string({ required: true })
      .validate(z.string().trim().min(3, 'Name is too short')),
    email: t.string({ required: true, validate: z.email('Enter a valid email') }),
  }),
});
builder.mutationType({
  fields: (t) => ({
    register: t.string({
      args: { input: t.arg({ type: Registration, required: true }) },
      errors: { types: [InputValidationError] },
      resolve: (_, { input }) => {
        names.push(input.name);
        return input.name;
      },
    }),
  }),
});
// #endregion mutation
export const schema = builder.toSchema();
