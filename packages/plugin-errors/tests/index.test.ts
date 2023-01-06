import { execute, printSchema } from 'graphql';
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
});
