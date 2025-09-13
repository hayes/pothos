import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import ErrorPlugin from '../src';
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
      });

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

    it('calls onResolvedError for item errors', async () => {
      const resolvedErrors: Error[] = [];

      const testBuilder = new SchemaBuilder<{}>({
        plugins: [ErrorPlugin],
        errors: {
          defaultTypes: [Error],
          onResolvedError: (error) => {
            resolvedErrors.push(error);
          },
        },
      });

      testBuilder.objectType(Error, {
        name: 'BaseError',
        fields: (t) => ({
          message: t.exposeString('message'),
        }),
      });

      interface TestItem {
        id: string;
        name: string;
      }

      const TestItemType = testBuilder.objectRef<TestItem>('TestItem');

      testBuilder.objectType(TestItemType, {
        fields: (t) => ({
          id: t.exposeString('id'),
          name: t.exposeString('name'),
        }),
      });

      testBuilder.queryType({
        fields: (t) => ({
          itemsWithErrors: t.field({
            type: [TestItemType],
            nullable: {
              items: true,
              list: false,
            },
            itemErrors: {},
            resolve: () => {
              return [
                { id: '1', name: 'Item 1' },
                new Error('Error in item 2') as never,
                { id: '3', name: 'Item 3' },
                new Error('Error in item 4') as never,
                { id: '5', name: 'Item 5' },
              ];
            },
          }),
        }),
      });

      const testSchema = testBuilder.toSchema();

      const result = await execute({
        schema: testSchema,
        document: gql`
          query {
            itemsWithErrors {
              __typename
              ... on TestItem {
                id
                name
              }
              ... on BaseError {
                message
              }
            }
          }
        `,
        contextValue: {},
      });

      expect(resolvedErrors).toHaveLength(2);
      expect(resolvedErrors[0]).toBeInstanceOf(Error);
      expect(resolvedErrors[0].message).toBe('Error in item 2');
      expect(resolvedErrors[1]).toBeInstanceOf(Error);
      expect(resolvedErrors[1].message).toBe('Error in item 4');

      // Verify the complete GraphQL result structure
      expect(result).toMatchInlineSnapshot(`
        {
          "data": {
            "itemsWithErrors": [
              {
                "__typename": "QueryItemsWithErrorsItemSuccess",
              },
              {
                "__typename": "BaseError",
                "message": "Error in item 2",
              },
              {
                "__typename": "QueryItemsWithErrorsItemSuccess",
              },
              {
                "__typename": "BaseError",
                "message": "Error in item 4",
              },
              {
                "__typename": "QueryItemsWithErrorsItemSuccess",
              },
            ],
          },
        }
      `);
    });
  });
});
