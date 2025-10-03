import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { builder } from './example/builder';
import { createSchema } from './example/schema';

const schema = createSchema(builder);

describe('validation plugin', () => {
  it('itemErrors', async () => {
    const query = gql`
    query {
        fieldWithValidation(string: "a") {
            __typename
            ... on QueryFieldWithValidationSuccess {
            result
            }
            ... on InputValidationError {
            issues {
                message
                path
            }
            }
        }
        validation2(stringList: ["a"]) {
            __typename
            ... on QueryValidation2Success {
            result
            }
            ... on InputValidationError {
            issues {
                message
                path
            }
            }
        }
        v: validation2(stringList: []) {
            __typename
            ... on QueryValidation2Success {
            result
            }
            ... on InputValidationError {
            issues {
                message
                path
            }
            }
        }
    }`;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "fieldWithValidation": {
            "__typename": "InputValidationError",
            "issues": [
              {
                "message": "Too short",
                "path": [
                  "string",
                ],
              },
            ],
          },
          "v": {
            "__typename": "InputValidationError",
            "issues": [
              {
                "message": "Always fails",
                "path": [],
              },
            ],
          },
          "validation2": {
            "__typename": "InputValidationError",
            "issues": [
              {
                "message": "Too short",
                "path": [
                  "stringList",
                  "0",
                ],
              },
            ],
          },
        },
      }
    `);
  });
});
