import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { builder } from './example/builder';
import { createSchema } from './example/schema';

const schema = createSchema(builder);

describe('errorUnionField', () => {
  it('returns CreateUserSuccess when action is create and no error', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnion($action: String!, $shouldFail: String) {
          testErrorUnion(action: $action, shouldFail: $shouldFail) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on UpdateUserSuccess {
              id
              updatedFields
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { action: 'create', shouldFail: null },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnion": {
            "__typename": "CreateUserSuccess",
            "id": "123",
            "name": "New User",
          },
        },
      }
    `);
  });

  it('returns UpdateUserSuccess when action is update and no error', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnion($action: String!, $shouldFail: String) {
          testErrorUnion(action: $action, shouldFail: $shouldFail) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on UpdateUserSuccess {
              id
              updatedFields
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { action: 'update', shouldFail: null },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnion": {
            "__typename": "UpdateUserSuccess",
            "id": "123",
            "updatedFields": [
              "name",
              "email",
            ],
          },
        },
      }
    `);
  });

  it('returns ValidationError when shouldFail is validation', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnion($action: String!, $shouldFail: String) {
          testErrorUnion(action: $action, shouldFail: $shouldFail) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on UpdateUserSuccess {
              id
              updatedFields
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { action: 'create', shouldFail: 'validation' },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnion": {
            "__typename": "ValidationError",
            "field": "name",
            "message": "Invalid input",
          },
        },
      }
    `);
  });

  it('returns NotFoundError when shouldFail is notFound', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnion($action: String!, $shouldFail: String) {
          testErrorUnion(action: $action, shouldFail: $shouldFail) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on UpdateUserSuccess {
              id
              updatedFields
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { action: 'create', shouldFail: 'notFound' },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnion": {
            "__typename": "NotFoundError",
            "message": "User not found",
          },
        },
      }
    `);
  });

  it('handles thrown ValidationError', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionThrow($shouldFail: String!) {
          testErrorUnionThrow(shouldFail: $shouldFail) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { shouldFail: 'validation' },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionThrow": {
            "__typename": "ValidationError",
            "field": "email",
            "message": "Thrown validation error",
          },
        },
      }
    `);
  });

  it('handles thrown NotFoundError', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionThrow($shouldFail: String!) {
          testErrorUnionThrow(shouldFail: $shouldFail) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { shouldFail: 'notFound' },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionThrow": {
            "__typename": "NotFoundError",
            "message": "Thrown not found error",
          },
        },
      }
    `);
  });

  it('uses custom resolveType for success result', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionCustomResolveType($type: String!) {
          testErrorUnionCustomResolveType(type: $type) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { type: 'success' },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionCustomResolveType": {
            "__typename": "CreateUserSuccess",
            "id": "789",
            "name": "Custom Resolve Type User",
          },
        },
      }
    `);
  });

  it('uses custom resolveType for ValidationError', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionCustomResolveType($type: String!) {
          testErrorUnionCustomResolveType(type: $type) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { type: 'validation' },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionCustomResolveType": {
            "__typename": "ValidationError",
            "field": "custom",
            "message": "Custom resolve type validation",
          },
        },
      }
    `);
  });

  it('uses custom resolveType for NotFoundError', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionCustomResolveType($type: String!) {
          testErrorUnionCustomResolveType(type: $type) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { type: 'notFound' },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionCustomResolveType": {
            "__typename": "NotFoundError",
            "message": "Custom resolve type not found",
          },
        },
      }
    `);
  });

  it('re-throws non-error types', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionThrowNonError {
          testErrorUnionThrowNonError {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
          }
        }
      `),
    });

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toBe('Unexpected error value: "string error"');
  });

  it('handles nullable error union fields returning null', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionNullable($returnNull: Boolean!) {
          testErrorUnionNullable(returnNull: $returnNull) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { returnNull: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionNullable": null,
        },
      }
    `);
  });

  it('handles nullable error union fields returning success', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionNullable($returnNull: Boolean!) {
          testErrorUnionNullable(returnNull: $returnNull) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { returnNull: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionNullable": {
            "__typename": "CreateUserSuccess",
            "id": "123",
            "name": "Nullable Test User",
          },
        },
      }
    `);
  });

  it('includes builder default error types', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionWithDefaultTypes($shouldThrowDefault: Boolean!) {
          testErrorUnionWithDefaultTypes(shouldThrowDefault: $shouldThrowDefault) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on BaseError {
              message
            }
          }
        }
      `),
      variableValues: { shouldThrowDefault: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionWithDefaultTypes": {
            "__typename": "BaseError",
            "message": "Default error type from builder",
          },
        },
      }
    `);
  });

  it('returns success when not using default error types', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionWithDefaultTypes($shouldThrowDefault: Boolean!) {
          testErrorUnionWithDefaultTypes(shouldThrowDefault: $shouldThrowDefault) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on BaseError {
              message
            }
          }
        }
      `),
      variableValues: { shouldThrowDefault: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionWithDefaultTypes": {
            "__typename": "CreateUserSuccess",
            "id": "456",
            "name": "Default Types Test User",
          },
        },
      }
    `);
  });
});

describe('errorUnionListField with errors option', () => {
  it('handles thrown error from resolver using errors option', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListWithErrors($throwNotFound: Boolean, $includeItemError: Boolean!) {
          testErrorUnionListWithErrors(throwNotFound: $throwNotFound, includeItemError: $includeItemError) {
            __typename
            ... on MutationTestErrorUnionListWithErrorsSuccess {
              data {
                __typename
                ... on CreateUserSuccess {
                  id
                  name
                }
                ... on ValidationError {
                  message
                  field
                }
              }
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { throwNotFound: true, includeItemError: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListWithErrors": {
            "__typename": "NotFoundError",
            "message": "List resolver threw NotFound",
          },
        },
      }
    `);
  });

  it('returns list with item errors using itemErrors handling', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListWithErrors($throwNotFound: Boolean, $includeItemError: Boolean!) {
          testErrorUnionListWithErrors(throwNotFound: $throwNotFound, includeItemError: $includeItemError) {
            __typename
            ... on MutationTestErrorUnionListWithErrorsSuccess {
              data {
                __typename
                ... on CreateUserSuccess {
                  id
                  name
                }
                ... on ValidationError {
                  message
                  field
                }
              }
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { throwNotFound: false, includeItemError: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListWithErrors": {
            "__typename": "MutationTestErrorUnionListWithErrorsSuccess",
            "data": [
              {
                "__typename": "CreateUserSuccess",
                "id": "1",
                "name": "User 1",
              },
              {
                "__typename": "ValidationError",
                "field": "item",
                "message": "Item error",
              },
              {
                "__typename": "CreateUserSuccess",
                "id": "2",
                "name": "User 2",
              },
            ],
          },
        },
      }
    `);
  });

  it('returns success list without errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListWithErrors($throwNotFound: Boolean, $includeItemError: Boolean!) {
          testErrorUnionListWithErrors(throwNotFound: $throwNotFound, includeItemError: $includeItemError) {
            __typename
            ... on MutationTestErrorUnionListWithErrorsSuccess {
              data {
                __typename
                ... on CreateUserSuccess {
                  id
                  name
                }
                ... on ValidationError {
                  message
                  field
                }
              }
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
      variableValues: { throwNotFound: false, includeItemError: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListWithErrors": {
            "__typename": "MutationTestErrorUnionListWithErrorsSuccess",
            "data": [
              {
                "__typename": "CreateUserSuccess",
                "id": "1",
                "name": "User 1",
              },
              {
                "__typename": "CreateUserSuccess",
                "id": "2",
                "name": "User 2",
              },
            ],
          },
        },
      }
    `);
  });
});

describe('errorUnionListField', () => {
  it('returns list of success types without errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionList($includeError: Boolean!) {
          testErrorUnionList(includeError: $includeError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionList": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  it('returns mixed list with success and error types', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionList($includeError: Boolean!) {
          testErrorUnionList(includeError: $includeError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionList": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "ValidationError",
              "field": "item",
              "message": "List error",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  it('returns list from sync iterable without errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListIterable($includeError: Boolean!) {
          testErrorUnionListIterable(includeError: $includeError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListIterable": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  it('returns list from sync iterable with errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListIterable($includeError: Boolean!) {
          testErrorUnionListIterable(includeError: $includeError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListIterable": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "ValidationError",
              "field": "item",
              "message": "Iterable error",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  // requires graphql 17
  it.skip('returns list from async iterable without errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListAsyncIterable($includeError: Boolean!, $throwError: Boolean!) {
          testErrorUnionListAsyncIterable(includeError: $includeError, throwError: $throwError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: false, throwError: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListAsyncIterable": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  // requires graphql 17
  it.skip('returns list from async iterable with yielded errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListAsyncIterable($includeError: Boolean!, $throwError: Boolean!) {
          testErrorUnionListAsyncIterable(includeError: $includeError, throwError: $throwError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: true, throwError: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListAsyncIterable": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "ValidationError",
              "field": "item",
              "message": "Async iterable error",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  it('throws GraphQL error when resolver throws', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListThrow($shouldThrow: Boolean!) {
          testErrorUnionListThrow(shouldThrow: $shouldThrow) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { shouldThrow: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListThrow": null,
        },
        "errors": [
          [GraphQLError: Thrown from list resolver],
        ],
      }
    `);
  });

  it('uses custom resolveType for list without errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListCustomResolveType($includeError: Boolean!) {
          testErrorUnionListCustomResolveType(includeError: $includeError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: false },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListCustomResolveType": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  it('uses custom resolveType for list with errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListCustomResolveType($includeError: Boolean!) {
          testErrorUnionListCustomResolveType(includeError: $includeError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListCustomResolveType": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "ValidationError",
              "field": "customItem",
              "message": "Custom list error",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  // requires graphql 17
  it.skip('returns list from async iterable with thrown error', async () => {
    const result = await execute({
      schema,
      document: parse(`
        mutation TestErrorUnionListAsyncIterable($includeError: Boolean!, $throwError: Boolean!) {
          testErrorUnionListAsyncIterable(includeError: $includeError, throwError: $throwError) {
            __typename
            ... on CreateUserSuccess {
              id
              name
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
      variableValues: { includeError: false, throwError: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "testErrorUnionListAsyncIterable": [
            {
              "__typename": "CreateUserSuccess",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "CreateUserSuccess",
              "id": "2",
              "name": "User 2",
            },
            {
              "__typename": "ValidationError",
              "field": "thrown",
              "message": "Thrown from async iterable",
            },
          ],
        },
      }
    `);
  });
});
