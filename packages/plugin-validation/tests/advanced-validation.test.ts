import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import * as zod from 'zod';
import '../src';
import schema from './example/schema';

describe('Advanced Validation', () => {
  describe('chaining API and transformations', () => {
    it('transforms string arguments with validation', async () => {
      const validQuery = gql`
        query {
          chainedArgTransforms(
            numericId: "123", 
            price: "99.99", 
            isActive: "true", 
            tags: "tag1,tag2"
          )
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.data?.chainedArgTransforms).toBeTruthy();
      const response = JSON.parse(result.data?.chainedArgTransforms as string);
      expect(response.numericId).toBe(123);
      expect(response.priceInCents).toBe(9999);
      expect(response.isActive).toBe(true);
      expect(response.tags).toEqual(['tag1', 'tag2']);
      expect(result.errors).toBeUndefined();
    });

    it('validates numeric ID transformation', async () => {
      const invalidQuery = gql`
        query {
          chainedArgTransforms(
            numericId: "0", 
            price: "50.00", 
            isActive: "no", 
            tags: "test"
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.data?.chainedArgTransforms).toBeNull();
      expect(result.errors).toBeDefined();
    });

    it('transforms input field values with chained validation', async () => {
      const query = gql`
        query {
          chainedTransformInput(input: {
            numericString: "123"
            dateString: "2023-01-15T10:00:00Z"
            uniqueTags: ["tag1", "tag2"]
            jsonConfig: "{\\"enabled\\": true, \\"level\\": 5}"
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.chainedTransformInput).toBeTruthy();
      const response = JSON.parse(result.data?.chainedTransformInput as string);
      expect(response.numericString).toBe(123);
      expect(response.dateString).toContain('2023');
      expect(response.uniqueTags).toEqual(['tag1', 'tag2']);
      expect(response.jsonConfig).toEqual({ enabled: true, level: 5 });
      expect(result.errors).toBeUndefined();
    });

    it('validates input field transformations', async () => {
      const invalidQuery = gql`
        query {
          chainedTransformInput(input: {
            numericString: "abc"
            dateString: "2019-01-15T10:00:00Z"
            uniqueTags: ["tag1", "tag2"]
            jsonConfig: "{\\"enabled\\": true, \\"level\\": 5}"
          })
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.data?.chainedTransformInput).toBeNull();
      expect(result.errors).toBeDefined();
    });

    it('validates async chained validation', async () => {
      const query = gql`
        query {
          asyncChainedValidation(
            username: "admin"
            email: "admin@example.com"
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: username: Username is taken",
            "path": [
              "asyncChainedValidation",
            ],
          },
        ]
      `);
    });

    it('validates multiple async validations', async () => {
      const query = gql`
        query {
          asyncChainedValidation(
            username: "validuser"
            email: "test@disposable.com"
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: email: Disposable emails not allowed",
            "path": [
              "asyncChainedValidation",
            ],
          },
        ]
      `);
    });

    it('validates args with t.validate and chaining', async () => {
      const query = gql`
        query {
          argsWithChaining(
            startTime: "17:00"
            endTime: "09:00"
            dayOfWeek: 1
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: : End time must be after start time",
            "path": [
              "argsWithChaining",
            ],
          },
        ]
      `);
    });

    it('passes async validation with valid args', async () => {
      const query = gql`
        query {
          asyncChainedValidation(
            username: "newuser"
            email: "newuser@example.com"
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ asyncChainedValidation: true });
    });

    it('validates async input field', async () => {
      const query = gql`
        query {
          asyncChainedInput(input: {
            username: "admin"
            email: "test@example.com"
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input.username: Username is reserved",
            "path": [
              "asyncChainedInput",
            ],
          },
        ]
      `);
    });

    it('validates multiple async validations on input field', async () => {
      const query = gql`
        query {
          asyncChainedInput(input: {
            username: "validuser"
            email: "test@temp-mail.com"
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input.email: Temporary email addresses not allowed",
            "path": [
              "asyncChainedInput",
            ],
          },
        ]
      `);
    });

    it('transforms with async validation', async () => {
      const query = gql`
        query {
          asyncChainedInput(input: {
            username: "TestUser"
            email: "Test@Example.COM"
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      if (result.data?.asyncChainedInput) {
        const data = JSON.parse(result.data.asyncChainedInput as string);
        expect(data.username).toBe('testuser');
        expect(data.email).toBe('test@example.com');
      }
    });
  });

  describe('t.validate() cross-field validation', () => {
    it('validates and transforms arguments together', async () => {
      const validQuery = gql`
        query {
          calculateDiscount(price: 100, discountType: "percentage", discountValue: 20)
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.data?.calculateDiscount).toBe('Original: $100, Discount: $20, Final: $80');
      expect(result.errors).toBeUndefined();
    });

    it('validates cross-field constraints', async () => {
      const invalidQuery = gql`
        query {
          calculateDiscount(price: 50, discountType: "fixed", discountValue: 100)
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.data?.calculateDiscount).toBeNull();
      expect(result.errors?.[0]?.message).toContain('Discount cannot exceed price');
    });

    it('converts temperature with validation', async () => {
      const validQuery = gql`
        query {
          convertTemperature(value: 0, unit: "C")
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.data?.convertTemperature).toBe(32);
      expect(result.errors).toBeUndefined();

      const invalidQuery = gql`
        query {
          convertTemperature(value: -300, unit: "C")
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.convertTemperature).toBeNull();
      expect(invalidResult.errors).toBeDefined();
    });

    it('combines field validation with chained validation', async () => {
      const validQuery = gql`
        query {
          advancedUserInput(email: "user@example.com", age: 30)
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.data?.advancedUserInput).toBe('User user@example.com, age 30');
      expect(result.errors).toBeUndefined();

      const invalidAgeQuery = gql`
        query {
          advancedUserInput(email: "user@example.com", age: 16)
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidAgeQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.advancedUserInput).toBeNull();
      expect(invalidResult.errors).toBeDefined();
    });
  });

  describe('async validation', () => {
    const asyncUserCheck = async (username: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return username !== 'taken';
    };

    const asyncEmailCheck = async (email: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return !email.includes('banned');
    };

    const asyncZipCheck = async (zip: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return zip !== '00000';
    };

    it('validates async field arguments', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
      });

      builder.queryType({
        fields: (t) => ({
          checkUser: t.boolean({
            args: {
              username: t.arg.string({
                validate: zod.z.string().refine(asyncUserCheck, {
                  message: 'Username is already taken',
                }),
              }),
              email: t.arg.string({
                validate: zod.z.string().email().refine(asyncEmailCheck, {
                  message: 'Email domain is banned',
                }),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const testSchema = builder.toSchema();

      const multipleFailQuery = gql`
        query {
          checkUser(username: "taken", email: "spam@banned.com")
        }
      `;

      const result = await execute({
        schema: testSchema,
        document: multipleFailQuery,
        contextValue: {},
      });

      expect(result.data?.checkUser).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: username: Username is already taken, email: Email domain is banned",
            "path": [
              "checkUser",
            ],
          },
        ]
      `);
    });

    it('combines sync and async field argument validation', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
      });

      builder.queryType({
        fields: (t) => ({
          registerUser: t.boolean({
            args: {
              username: t.arg.string({
                validate: zod.z
                  .string()
                  .min(3, 'Username must be at least 3 characters')
                  .refine(asyncUserCheck, { message: 'Username is already taken' }),
              }),
              email: t.arg.string({
                validate: zod.z
                  .string()
                  .email('Invalid email format')
                  .refine(asyncEmailCheck, { message: 'Email domain is banned' }),
              }),
              age: t.arg.int({
                validate: zod.z.number().min(18, 'Must be at least 18 years old'),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const testSchema = builder.toSchema();

      const mixedFailQuery = gql`
        query {
          registerUser(username: "taken", email: "invalid-email", age: 16)
        }
      `;

      const result = await execute({
        schema: testSchema,
        document: mixedFailQuery,
        contextValue: {},
      });

      expect(result.data?.registerUser).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: age: Must be at least 18 years old, username: Username is already taken, email: Invalid email format",
            "path": [
              "registerUser",
            ],
          },
        ]
      `);
    });

    it('validates async cross-field constraints', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
      });

      builder.queryType({
        fields: (t) => ({
          createUser: t.boolean({
            args: {
              username: t.arg.string(),
              email: t.arg.string(),
              role: t.arg.string(),
            },
            validate: zod.z
              .object({
                username: zod.z.string(),
                email: zod.z.string().email(),
                role: zod.z.string(),
              })
              .refine(
                async (data) => {
                  await new Promise((resolve) => setTimeout(resolve, 1));
                  return !(data.role === 'admin' && data.username.length < 5);
                },
                { message: 'Admin users must have usernames with at least 5 characters' },
              ),
            resolve: () => true,
          }),
        }),
      });

      const testSchema = builder.toSchema();

      const conflictQuery = gql`
        query {
          createUser(username: "adm", email: "test@example.com", role: "admin")
        }
      `;

      const result = await execute({
        schema: testSchema,
        document: conflictQuery,
        contextValue: {},
      });

      expect(result.data?.createUser).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: : Admin users must have usernames with at least 5 characters",
            "path": [
              "createUser",
            ],
          },
        ]
      `);
    });

    it('validates async input fields', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
      });

      const UserInput = builder.inputType('UserInput', {
        fields: (t) => ({
          username: t.string({
            validate: zod.z.string().refine(asyncUserCheck, {
              message: 'Username is already taken',
            }),
          }),
          email: t.string({
            validate: zod.z.string().email().refine(asyncEmailCheck, {
              message: 'Email domain is banned',
            }),
          }),
        }),
      });

      builder.queryType({
        fields: (t) => ({
          registerUser: t.boolean({
            args: {
              user: t.arg({ type: UserInput }),
            },
            resolve: () => true,
          }),
        }),
      });

      const testSchema = builder.toSchema();

      const multipleFieldFailQuery = gql`
        query {
          registerUser(user: { username: "taken", email: "spam@banned.com" })
        }
      `;

      const result = await execute({
        schema: testSchema,
        document: multipleFieldFailQuery,
        contextValue: {},
      });

      expect(result.data?.registerUser).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: user.username: Username is already taken, user.email: Email domain is banned",
            "path": [
              "registerUser",
            ],
          },
        ]
      `);
    });

    it('validates async constraints in nested input structures', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
      });

      const AddressInput = builder.inputType('AddressInput', {
        fields: (t) => ({
          zipCode: t.string({
            validate: zod.z.string().refine(asyncZipCheck, {
              message: 'Invalid zip code',
            }),
          }),
        }),
      });

      const UserWithAddressInput = builder.inputType('UserWithAddressInput', {
        fields: (t) => ({
          username: t.string({
            validate: zod.z.string().refine(asyncUserCheck, {
              message: 'Username is already taken',
            }),
          }),
          address: t.field({ type: AddressInput }),
        }),
      });

      builder.queryType({
        fields: (t) => ({
          createUserWithAddress: t.boolean({
            args: {
              user: t.arg({ type: UserWithAddressInput }),
            },
            resolve: () => true,
          }),
        }),
      });

      const testSchema = builder.toSchema();

      const nestedFailQuery = gql`
        query {
          createUserWithAddress(user: { 
            username: "taken", 
            address: { zipCode: "00000" }
          })
        }
      `;

      const result = await execute({
        schema: testSchema,
        document: nestedFailQuery,
        contextValue: {},
      });

      expect(result.data?.createUserWithAddress).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: user.username: Username is already taken, user.address.zipCode: Invalid zip code",
            "path": [
              "createUserWithAddress",
            ],
          },
        ]
      `);
    });

    it('validates async constraints in array elements', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
      });

      builder.queryType({
        fields: (t) => ({
          checkUsernames: t.boolean({
            args: {
              usernames: t.arg.stringList({
                validate: zod.z.array(
                  zod.z.string().refine(asyncUserCheck, {
                    message: 'Username is already taken',
                  }),
                ),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const testSchema = builder.toSchema();

      const arrayFailQuery = gql`
        query {
          checkUsernames(usernames: ["taken", "available", "taken"])
        }
      `;

      const result = await execute({
        schema: testSchema,
        document: arrayFailQuery,
        contextValue: {},
      });

      expect(result.data?.checkUsernames).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: usernames.0: Username is already taken, usernames.2: Username is already taken",
            "path": [
              "checkUsernames",
            ],
          },
        ]
      `);
    });

    it('combines sync and async validation in arrays', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
      });

      builder.queryType({
        fields: (t) => ({
          validateUsernames: t.boolean({
            args: {
              usernames: t.arg.stringList({
                validate: zod.z
                  .array(
                    zod.z
                      .string()
                      .min(3, 'Username must be at least 3 characters')
                      .refine(asyncUserCheck, { message: 'Username is already taken' }),
                  )
                  .min(1, 'At least one username is required')
                  .max(5, 'Maximum 5 usernames allowed'),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const testSchema = builder.toSchema();

      const mixedArrayFailQuery = gql`
        query {
          validateUsernames(usernames: ["xy", "taken", "ab"])
        }
      `;

      const result = await execute({
        schema: testSchema,
        document: mixedArrayFailQuery,
        contextValue: {},
      });

      expect(result.data?.validateUsernames).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: usernames.0: Username must be at least 3 characters, usernames.2: Username must be at least 3 characters, usernames.1: Username is already taken",
            "path": [
              "validateUsernames",
            ],
          },
        ]
      `);
    });
  });

  describe('complex validation patterns', () => {
    it('validates recursive input types', async () => {
      const validQuery = gql`
        query {
          exampleField(
            odd: 1
            recursive: {
              float: 1.5
              number: 2
              recurse: {
                float: 2.5
                number: 4
              }
            }
            contactInfo: {
              name: "John"
              email: "john@test.com"
              phone: "555-123-4567"
              aliases: ["Johnny", "JD"]
            }
            enum1: [One]
          )
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.data?.exampleField).toBe(1);
      expect(result.errors).toBeUndefined();
    });

    it('validates multiple constraint violations', async () => {
      const invalidQuery = gql`
        query {
          exampleField(
            odd: 2
            recursive: {
              float: 1.0
              number: 3
            }
            contactInfo: {
              name: "john"
              email: "john@example.com"
              aliases: ["j"]
            }
            enum1: [Two]
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.data?.exampleField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: enum1: Invalid input, recursive.float: Invalid input, contactInfo.aliases.0: Aliases should be capitalized, contactInfo.name: Name should be capitalized",
            "path": [
              "exampleField",
            ],
          },
        ]
      `);
    });
  });
});
