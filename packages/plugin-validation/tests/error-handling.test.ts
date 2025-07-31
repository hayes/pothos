import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import * as zod from 'zod';
import '../src';

describe('Error Handling', () => {
  describe('custom validation error handling', () => {
    it('allows custom error handling with Error objects', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(
              `Custom validation error: ${failure.issues.map((i) => i.message).join(', ')}`,
            );
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string({
                validate: zod.z.string().email(),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(email: "invalid-email")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Custom validation error: Invalid email",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });

    it('allows custom error handling with string messages', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return `String error: ${failure.issues[0]?.message || 'Unknown validation error'}`;
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              age: t.arg.int({
                validate: zod.z.number().min(18),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(age: 16)
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.[0]?.message).toBe(
        'String error: Number must be greater than or equal to 18',
      );
    });

    it('provides access to args, and context in validationError handler', async () => {
      let capturedArgs: unknown;
      let capturedContext: unknown;

      const builder = new SchemaBuilder<{
        Context: { userId: string };
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (_failure, args, context) => {
            capturedArgs = args;
            capturedContext = context;
            return new Error('Validation failed with captured info');
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string({
                validate: zod.z.string().email(),
              }),
              name: t.arg.string(),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(email: "invalid", name: "John")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: { userId: 'test-user-123' },
      });

      expect(result.errors?.[0]?.message).toBe('Validation failed with captured info');
      expect(capturedArgs).toEqual({ email: 'invalid', name: 'John' });
      expect(capturedContext).toEqual({ userId: 'test-user-123' });
    });

    it('works with field-level validation using custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(
              `Field validation failed: ${failure.issues.map((i) => i.message).join(' | ')}`,
            );
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string(),
              phone: t.arg.string(),
            },
            validate: zod.z
              .object({
                email: zod.z.string().optional(),
                phone: zod.z.string().optional(),
              })
              .refine((args) => !!args.phone || !!args.email, {
                message: 'Must provide either phone or email',
              }),
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Field validation failed: Must provide either phone or email",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });

    it('handles multiple validation issues in custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            const messages = failure.issues.map(
              (issue) => `${issue.path?.join('.') || 'root'}: ${issue.message}`,
            );
            return new Error(`Multiple validation errors: ${messages.join('; ')}`);
          },
        },
      });

      const UserInput = builder.inputType('UserInput', {
        fields: (t) => ({
          name: t.string({
            validate: zod.z.string().min(5),
          }),
          email: t.string({
            validate: zod.z.string().email(),
          }),
        }),
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              user: t.arg({ type: UserInput }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(user: { name: "x", email: "invalid" })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Multiple validation errors: user.name: String must contain at least 5 character(s)",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });
  });

  describe('edge cases', () => {
    it('handles validationError handler that throws an error', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (_failure, _args, _context) => {
            throw new Error('Custom thrown error from handler');
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string({
                validate: zod.z.string().email(),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(email: "invalid")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.[0]?.message).toBe('Custom thrown error from handler');
    });

    it('handles async validation with custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(`Async validation failed: ${failure.issues[0]?.message}`);
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              username: t.arg.string({
                validate: zod.z.string().refine(
                  async (username) => {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    return username !== 'taken';
                  },
                  {
                    message: 'Username is already taken',
                  },
                ),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(username: "taken")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.[0]?.message).toBe(
        'Async validation failed: Username is already taken',
      );
    });

    it('works with input type validation using custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(
              `Input validation failed: ${failure.issues.map((i) => i.message).join(', ')}`,
            );
          },
        },
      });

      const UserInput = builder.inputType('UserInput', {
        fields: (t) => ({
          name: t.string({
            validate: zod.z.string().min(2),
          }),
          age: t.int({
            validate: zod.z.number().min(18),
          }),
        }),
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              user: t.arg({ type: UserInput }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(user: { name: "x", age: 16 })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Input validation failed: String must contain at least 2 character(s)",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });
  });
});
