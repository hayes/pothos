import { execute, printSchema, subscribe } from 'graphql';
import { gql } from 'graphql-tag';
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

    // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
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
