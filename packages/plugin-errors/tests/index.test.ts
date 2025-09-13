import SchemaBuilder from '@pothos/core';
import { execute, printSchema, subscribe } from 'graphql';
import { gql } from 'graphql-tag';
import ErrorPlugin from '../src';
import { builder, builderWithCustomErrorTypeNames } from './example/builder';
import { createSchema } from './example/schema';

const schema = createSchema(builder);

describe('errors plugin', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();

    expect(() => {
      builder.toSchema();
    }).not.toThrow();
  });

  it('query some stuff', async () => {
    const query = gql`
      query {
        simpleError {
          __typename
          ... on QuerySimpleErrorResult {
            data
          }
          ... on Error {
            message
          }
        }
        extendedError {
          __typename
          ... on QueryExtendedErrorResult {
            data
          }
          ... on Error {
            message
          }
        }

        simpleErrorError: simpleError(throw: true) {
          __typename
          ... on QuerySimpleErrorResult {
            data
          }
          ... on Error {
            message
          }
        }
        extendedErrorError: extendedError(throw: "error") {
          __typename
          ... on QueryExtendedErrorResult {
            data
          }
          ... on Error {
            message
          }
        }

        extendedErrorExtended: extendedError(throw: "extended") {
          __typename
          ... on QueryExtendedErrorResult {
            data
          }
          ... on Error {
            message
          }
        }

        extendedErrorExtended2: extendedError(throw: "extended2") {
          __typename
          ... on QueryExtendedErrorResult {
            data
          }
          ... on Error {
            message
          }
        }

        extendedErrorOther: extendedError(throw: "other") {
          __typename
          ... on QueryExtendedErrorResult {
            data
          }
          ... on Error {
            message
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "extendedError": {
            "__typename": "QueryExtendedErrorSuccess",
            "data": "ok",
          },
          "extendedErrorError": {
            "__typename": "BaseError",
            "message": "Error from extendedError",
          },
          "extendedErrorExtended": {
            "__typename": "ExtendedError",
            "message": "Error from extendedError",
          },
          "extendedErrorExtended2": {
            "__typename": "Extended2Error",
            "message": "Error from extendedError",
          },
          "extendedErrorOther": null,
          "simpleError": {
            "__typename": "QuerySimpleErrorSuccess",
            "data": "ok",
          },
          "simpleErrorError": {
            "__typename": "BaseError",
            "message": "Error from simpleError field",
          },
        },
        "errors": [
          [GraphQLError: Unexpected error value: { message: "Error from extendedError" }],
        ],
      }
    `);
  });

  it('query directResult', async () => {
    const query = gql`
      query {
        directResult {
          __typename
          ... on DirectResult {
            id
          }
        }
        withError: directResult(shouldThrow: true) {
          __typename
          ... on Error {
            message
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "directResult": {
            "__typename": "DirectResult",
            "id": "123",
          },
          "withError": {
            "__typename": "BaseError",
            "message": "Boom",
          },
        },
      }
    `);
  });

  it('supports generating custom names', () => {
    const schemaWithCustomTypeNames = createSchema(builderWithCustomErrorTypeNames);
    expect(printSchema(schemaWithCustomTypeNames)).toMatchSnapshot();

    expect(() => {
      builderWithCustomErrorTypeNames.toSchema();
    }).not.toThrow();
  });

  it('subscription without errors', async () => {
    const result = await subscribe({
      schema,
      document: gql`
        subscription {
          test {
            __typename
            ... on Error {
              message
            }
            ... on SubscriptionTestResult {
              data
            }
          }
        }
      `,
    });

    const results = [];
    for await (const value of result as AsyncIterable<{ data: { hello: number } }>) {
      results.push(value);
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "test": {
              "__typename": "SubscriptionTestSuccess",
              "data": 1,
            },
          },
        },
        {
          "data": {
            "test": {
              "__typename": "SubscriptionTestSuccess",
              "data": 2,
            },
          },
        },
        {
          "data": {
            "test": {
              "__typename": "SubscriptionTestSuccess",
              "data": 3,
            },
          },
        },
      ]
    `);
  });

  it('subscription null', async () => {
    const result = await subscribe({
      schema,
      document: gql`
        subscription {
          test(returnNull: true) {
            __typename
            ... on Error {
              message
            }
            ... on SubscriptionTestResult {
              data
            }
          }
        }
      `,
    });

    const results = [];
    for await (const value of result as AsyncIterable<{ data: { hello: number } }>) {
      results.push(value);
    }

    // biome-ignore lint/style/noUnusedTemplateLiteral: snapshot
    expect(results).toMatchInlineSnapshot(`[]`);
  });

  it('subscription error on subscribe', async () => {
    const result = await subscribe({
      schema,
      document: gql`
        subscription {
          test(errorOnSubscribe: true) {
            __typename
            ... on Error {
              message
            }
            ... on SubscriptionTestResult {
              data
            }
          }
        }
      `,
    });

    const results = [];
    for await (const value of result as AsyncIterable<{ data: { hello: number } }>) {
      results.push(value);
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "test": {
              "__typename": "BaseError",
              "message": "error on subscribe",
            },
          },
        },
      ]
    `);
  });

  it('subscription error in resolve', async () => {
    const result = await subscribe({
      schema,
      document: gql`
        subscription {
          test(errorOnResolve: true) {
            __typename
            ... on Error {
              message
            }
            ... on SubscriptionTestResult {
              data
            }
          }
        }
      `,
    });

    const results = [];
    for await (const value of result as AsyncIterable<{ data: { hello: number } }>) {
      results.push(value);
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "test": {
              "__typename": "BaseError",
              "message": "error on resolve",
            },
          },
        },
        {
          "data": {
            "test": {
              "__typename": "BaseError",
              "message": "error on resolve",
            },
          },
        },
        {
          "data": {
            "test": {
              "__typename": "BaseError",
              "message": "error on resolve",
            },
          },
        },
      ]
    `);
  });

  it('subscription error in iterable', async () => {
    const result = await subscribe({
      schema,
      document: gql`
        subscription {
          test(errorInIterable: true) {
            __typename
            ... on Error {
              message
            }
            ... on SubscriptionTestResult {
              data
            }
          }
        }
      `,
    });

    const results = [];
    for await (const value of result as AsyncIterable<{ data: { hello: number } }>) {
      results.push(value);
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "test": {
              "__typename": "SubscriptionTestSuccess",
              "data": 1,
            },
          },
        },
        {
          "data": {
            "test": {
              "__typename": "BaseError",
              "message": "error on subscribe",
            },
          },
        },
      ]
    `);
  });

  it('subscription error in iterable and resolve', async () => {
    const result = await subscribe({
      schema,
      document: gql`
        subscription {
          test(errorInIterable: true, errorOnResolve: true) {
            __typename
            ... on Error {
              message
            }
            ... on SubscriptionTestResult {
              data
            }
          }
        }
      `,
    });

    const results = [];
    for await (const value of result as AsyncIterable<{ data: { hello: number } }>) {
      results.push(value);
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "test": {
              "__typename": "BaseError",
              "message": "error on resolve",
            },
          },
        },
        {
          "data": {
            "test": {
              "__typename": "BaseError",
              "message": "error on subscribe",
            },
          },
        },
      ]
    `);
  });
});

describe('onResolvedError callback', () => {
  it('calls onResolvedError when errors are handled', async () => {
    const resolvedErrors: Error[] = [];

    const testBuilder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [],
        onResolvedError: (error) => {
          resolvedErrors.push(error);
        },
      },
    });

    testBuilder.objectType(Error, {
      name: 'Error',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    testBuilder.queryType({
      fields: (t) => ({
        testField: t.field({
          type: 'String',
          errors: {
            types: [Error],
          },
          resolve: () => {
            throw new Error('Test error message');
          },
        }),
      }),
    });

    const testSchema = testBuilder.toSchema();

    const result = await execute({
      schema: testSchema,
      document: gql`
        query {
          testField {
            __typename
            ... on Error {
              message
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(resolvedErrors).toHaveLength(1);
    expect(resolvedErrors[0]).toBeInstanceOf(Error);
    expect(resolvedErrors[0].message).toBe('Test error message');

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testField": {
            "__typename": "Error",
            "message": "Test error message",
          },
        },
      }
    `);
  });

  it('does not call onResolvedError for unhandled errors', async () => {
    const resolvedErrors: Error[] = [];

    class HandledError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'HandledError';
      }
    }

    class UnhandledError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'UnhandledError';
      }
    }

    const testBuilder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [],
        onResolvedError: (error) => {
          resolvedErrors.push(error);
        },
      },
    });

    testBuilder.objectType(HandledError, {
      name: 'HandledError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    testBuilder.queryType({
      fields: (t) => ({
        testField: t.field({
          type: 'String',
          errors: {
            types: [HandledError],
          },
          resolve: () => {
            throw new UnhandledError('This error is not handled by the plugin');
          },
        }),
      }),
    });

    const testSchema = testBuilder.toSchema();

    const result = await execute({
      schema: testSchema,
      document: gql`
        query {
          testField {
            __typename
          }
        }
      `,
      contextValue: {},
    });

    expect(resolvedErrors).toHaveLength(0);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain('This error is not handled by the plugin');
  });

  it('calls onResolvedError for handled errors but not unhandled ones', async () => {
    const resolvedErrors: Error[] = [];

    class HandledError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'HandledError';
      }
    }

    class UnhandledError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'UnhandledError';
      }
    }

    const testBuilder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [],
        onResolvedError: (error) => {
          resolvedErrors.push(error);
        },
      },
    });

    testBuilder.objectType(HandledError, {
      name: 'HandledError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    testBuilder.queryType({
      fields: (t) => ({
        handledField: t.field({
          type: 'String',
          errors: {
            types: [HandledError],
          },
          resolve: () => {
            throw new HandledError('This error is handled');
          },
        }),
        unhandledField: t.field({
          type: 'String',
          errors: {
            types: [HandledError], // Only catching HandledError
          },
          resolve: () => {
            throw new UnhandledError('This error is not handled');
          },
        }),
      }),
    });

    const testSchema = testBuilder.toSchema();

    // Test handled error
    const handledResult = await execute({
      schema: testSchema,
      document: gql`
        query {
          handledField {
            __typename
            ... on HandledError {
              message
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(resolvedErrors).toHaveLength(1);
    expect(resolvedErrors[0]).toBeInstanceOf(HandledError);
    expect(resolvedErrors[0].message).toBe('This error is handled');
    expect(handledResult.errors).toBeUndefined();

    const unhandledResult = await execute({
      schema: testSchema,
      document: gql`
        query {
          unhandledField {
            __typename
          }
        }
      `,
      contextValue: {},
    });

    expect(resolvedErrors).toHaveLength(1);
    expect(unhandledResult.errors).toBeDefined();
    expect(unhandledResult.errors?.[0].message).toContain('This error is not handled');
  });
});
