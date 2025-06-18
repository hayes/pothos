import { execute, experimentalExecuteIncrementally, type ExperimentalIncrementalExecutionResults,  } from 'graphql';
import { gql } from 'graphql-tag';
import { builder } from './example/builder';
import { createSchema } from './example/schema';

const schema = createSchema(builder);

describe('errors plugin', () => {
  describe('item errors', () => {
    it('itemErrors', async () => {
      const query = gql`
        query {
          itemErrors {
            __typename
            ... on QueryItemErrorsItemSuccess {
              data {
                id
              }
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
            "itemErrors": [
              {
                "__typename": "QueryItemErrorsItemSuccess",
                "data": {
                  "id": "123",
                },
              },
              {
                "__typename": "BaseError",
                "message": "Boom",
              },
            ],
          },
        }
      `);
    });
    it('itemErrorsDirectResult', async () => {
      const query = gql`
        query {
          itemErrorsDirectResult {
            __typename
            ... on DirectResult {
              id
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
            "itemErrorsDirectResult": [
              {
                "__typename": "DirectResult",
                "id": "123",
              },
              {
                "__typename": "BaseError",
                "message": "Boom",
              },
            ],
          },
        }
      `);
    });

    it('itemErrorsWithFieldErrors', async () => {
      const query = gql`
        query {
          itemErrorsWithFieldErrors {
            __typename
            ... on QueryItemErrorsWithFieldErrorsSuccess {
              __typename
              data {
                __typename
                ... on QueryItemErrorsWithFieldErrorsItemSuccess {
                  data {
                    id
                  }
                }
                ... on Error {
                  message
                }
              }
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
            "itemErrorsWithFieldErrors": {
              "__typename": "QueryItemErrorsWithFieldErrorsSuccess",
              "data": [
                {
                  "__typename": "QueryItemErrorsWithFieldErrorsItemSuccess",
                  "data": {
                    "id": "123",
                  },
                },
                {
                  "__typename": "BaseError",
                  "message": "Boom",
                },
              ],
            },
          },
        }
      `);
    });

    // requires graphql 17
    it.skip('asyncItemErrors', async () => {
      const query = gql`
        query {
          asyncItemErrors {
            ...on QueryAsyncItemErrorsSuccess {
              data {
                __typename
                  ... on QueryAsyncItemErrorsItemSuccess {
                    data {
                      id
                    }
                  }
                  ... on Error {
                    message
                  }
              }
            }
            ... on Error {
              message
            }
          }
          withError: asyncItemErrors(error: true) {
            __typename
            ... on QueryAsyncItemErrorsSuccess {
              data {
                id
              }
            }
            ... on Error {
              message
            }
          }
        }
      `;

      const results = await execute({
        schema,
        document: query,
        contextValue: {},
      })

      expect(results).toMatchInlineSnapshot(`
        {
          "data": {
            "asyncItemErrors": {
              "data": [
                {
                  "__typename": "QueryAsyncItemErrorsItemSuccess",
                  "data": {
                    "id": "123",
                  },
                },
                {
                  "__typename": "BaseError",
                  "message": "Boom",
                },
                {
                  "__typename": "QueryAsyncItemErrorsItemSuccess",
                  "data": {
                    "id": "123",
                  },
                },
                {
                  "__typename": "BaseError",
                  "message": "Boom",
                },
              ],
            },
            "withError": {
              "__typename": "BaseError",
              "message": "Boom",
            },
          },
        }
      `);
    });
  });
});
