import { execute, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import builder from './example/builder';
import schema from './example/schema';

describe('mocked', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();

    expect(() => {
      builder.toSchema({});
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
      Object {
        "data": Object {
          "extendedError": Object {
            "__typename": "QueryExtendedErrorSuccess",
            "data": "ok",
          },
          "extendedErrorError": Object {
            "__typename": "BaseError",
            "message": "Error from extendedError",
          },
          "extendedErrorExtended": Object {
            "__typename": "ExtendedError",
            "message": "Error from extendedError",
          },
          "extendedErrorExtended2": Object {
            "__typename": "Extended2Error",
            "message": "Error from extendedError",
          },
          "extendedErrorOther": null,
          "simpleError": Object {
            "__typename": "QuerySimpleErrorSuccess",
            "data": "ok",
          },
          "simpleErrorError": Object {
            "__typename": "BaseError",
            "message": "Error from simpleError field",
          },
        },
        "errors": Array [
          [GraphQLError: Unexpected error value: { message: "Error from extendedError" }],
        ],
      }
    `);
  });
});
