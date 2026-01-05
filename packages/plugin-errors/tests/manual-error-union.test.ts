import SchemaBuilder from '@pothos/core';
import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import ErrorsPlugin from '../src';

// Error classes
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  field: string;
  constructor(message: string, field: string) {
    super(message);
    this.field = field;
    this.name = 'ValidationError';
  }
}

describe('builder.errorUnion - comprehensive tests', () => {
  const builder = new SchemaBuilder({
    plugins: [ErrorsPlugin],
    errors: {
      defaultTypes: [Error],
    },
  });

  // Error interface
  const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
    fields: (t) => ({
      message: t.exposeString('message'),
    }),
  });

  // Base error type
  builder.objectType(Error, {
    name: 'BaseError',
    interfaces: [ErrorInterface],
  });

  // Custom error types
  builder.objectType(NotFoundError, {
    name: 'NotFoundError',
    interfaces: [ErrorInterface],
    isTypeOf: (value) => value instanceof NotFoundError,
  });

  builder.objectType(ValidationError, {
    name: 'ValidationError',
    interfaces: [ErrorInterface],
    isTypeOf: (value) => value instanceof ValidationError,
    fields: (t) => ({
      field: t.exposeString('field'),
    }),
  });

  // Success type
  const UserType = builder.objectRef<{ id: string; name: string }>('User').implement({
    isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj,
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
    }),
  });

  // Error union using builder.errorUnion
  const UserResult = builder.errorUnion('UserResult', {
    types: [UserType, NotFoundError, ValidationError],
  });

  builder.queryType({
    fields: (t) => ({
      // Non-list field - thrown errors
      getUser: t.field({
        type: UserResult,
        args: {
          id: t.arg.string({ required: true }),
          shouldFail: t.arg.string(),
        },
        resolve: (_, args) => {
          if (args.shouldFail === 'notFound') {
            throw new NotFoundError('User not found');
          }
          if (args.shouldFail === 'validation') {
            throw new ValidationError('Invalid ID format', 'id');
          }
          return { id: args.id, name: 'Test User' };
        },
      }),

      // Non-list field - returned errors
      getUserReturned: t.field({
        type: UserResult,
        args: {
          id: t.arg.string({ required: true }),
          shouldFail: t.arg.string(),
        },
        resolve: (_, args) => {
          if (args.shouldFail === 'notFound') {
            return new NotFoundError('User not found (returned)') as never;
          }
          if (args.shouldFail === 'validation') {
            return new ValidationError('Invalid ID format (returned)', 'id') as never;
          }
          return { id: args.id, name: 'Test User' };
        },
      }),

      // List field - returned errors (items in array)
      getUsers: t.field({
        type: [UserResult],
        args: {
          includeError: t.arg.boolean({ required: true }),
        },
        resolve: (_, args) => {
          const results: (typeof UserType.$inferType | ValidationError)[] = [
            { id: '1', name: 'User 1' },
          ];
          if (args.includeError) {
            results.push(new ValidationError('Invalid user', 'data'));
          }
          results.push({ id: '2', name: 'User 2' });
          return results;
        },
      }),

      // List field - thrown error (entire field fails)
      getUsersThrown: t.field({
        type: [UserResult],
        args: {
          shouldFail: t.arg.boolean({ required: true }),
        },
        resolve: (_, args) => {
          if (args.shouldFail) {
            throw new NotFoundError('Users not found');
          }
          return [
            { id: '1', name: 'User 1' },
            { id: '2', name: 'User 2' },
          ];
        },
      }),
    }),
  });

  const schema = builder.toSchema();

  it('catches thrown NotFoundError', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUser(id: "123", shouldFail: "notFound") {
            __typename
            ... on User {
              id
              name
            }
            ... on NotFoundError {
              message
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUser": {
            "__typename": "NotFoundError",
            "message": "User not found",
          },
        },
      }
    `);
  });

  it('catches thrown ValidationError', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUser(id: "123", shouldFail: "validation") {
            __typename
            ... on User {
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
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUser": {
            "__typename": "ValidationError",
            "field": "id",
            "message": "Invalid ID format",
          },
        },
      }
    `);
  });

  it('returns success value normally', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUser(id: "123") {
            __typename
            ... on User {
              id
              name
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUser": {
            "__typename": "User",
            "id": "123",
            "name": "Test User",
          },
        },
      }
    `);
  });

  it('wraps returned error instances', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUserReturned(id: "123", shouldFail: "validation") {
            __typename
            ... on User {
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
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUserReturned": {
            "__typename": "ValidationError",
            "field": "id",
            "message": "Invalid ID format (returned)",
          },
        },
      }
    `);
  });

  it('handles list with item errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUsers(includeError: true) {
            __typename
            ... on User {
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
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUsers": [
            {
              "__typename": "User",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "ValidationError",
              "field": "data",
              "message": "Invalid user",
            },
            {
              "__typename": "User",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  it('handles list without errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUsers(includeError: false) {
            __typename
            ... on User {
              id
              name
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUsers": [
            {
              "__typename": "User",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "User",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });

  it('thrown errors in list fields propagate as GraphQL errors (not caught)', async () => {
    // Note: Error unions for lists handle RETURNED error items, not thrown errors
    // Thrown errors should propagate as normal GraphQL errors
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUsersThrown(shouldFail: true) {
            __typename
            ... on User {
              id
              name
            }
            ... on NotFoundError {
              message
            }
          }
        }
      `),
    });

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toBe('Users not found');
    expect(result.data?.getUsersThrown).toBeNull();
  });

  it('returns list when no error is thrown', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUsersThrown(shouldFail: false) {
            __typename
            ... on User {
              id
              name
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUsersThrown": [
            {
              "__typename": "User",
              "id": "1",
              "name": "User 1",
            },
            {
              "__typename": "User",
              "id": "2",
              "name": "User 2",
            },
          ],
        },
      }
    `);
  });
});

describe('builder.errorUnion with defaultTypes', () => {
  const builder = new SchemaBuilder({
    plugins: [ErrorsPlugin],
    errors: {
      defaultTypes: [Error],
    },
  });

  // Error interface
  const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
    fields: (t) => ({
      message: t.exposeString('message'),
    }),
  });

  builder.objectType(Error, {
    name: 'BaseError',
    interfaces: [ErrorInterface],
  });

  const UserType = builder.objectRef<{ id: string; name: string }>('User').implement({
    isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj,
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
    }),
  });

  // Error union - defaultTypes (Error) will be automatically included
  const UserResult = builder.errorUnion('UserResult', {
    types: [UserType],
  });

  builder.queryType({
    fields: (t) => ({
      getUser: t.field({
        type: UserResult,
        args: {
          shouldFail: t.arg.boolean(),
        },
        resolve: (_, args) => {
          if (args.shouldFail) {
            throw new Error('Something went wrong');
          }
          return { id: '1', name: 'Test User' };
        },
      }),
    }),
  });

  const schema = builder.toSchema();

  it('catches errors from defaultTypes', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUser(shouldFail: true) {
            __typename
            ... on User {
              id
              name
            }
            ... on BaseError {
              message
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUser": {
            "__typename": "BaseError",
            "message": "Something went wrong",
          },
        },
      }
    `);
  });
});

describe('non-error union is not affected', () => {
  const builder = new SchemaBuilder({
    plugins: [ErrorsPlugin],
    errors: {
      defaultTypes: [],
    },
  });

  const TypeA = builder.objectRef<{ a: string }>('TypeA').implement({
    isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'a' in obj,
    fields: (t) => ({
      a: t.exposeString('a'),
    }),
  });

  const TypeB = builder.objectRef<{ b: string }>('TypeB').implement({
    isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'b' in obj,
    fields: (t) => ({
      b: t.exposeString('b'),
    }),
  });

  // Regular union (not created with errorUnion) - should NOT get error handling
  const RegularUnion = builder.unionType('RegularUnion', {
    types: [TypeA, TypeB],
    resolveType: (value) => {
      if ('a' in value) {
        return 'TypeA';
      }
      return 'TypeB';
    },
  });

  builder.queryType({
    fields: (t) => ({
      getRegular: t.field({
        type: RegularUnion,
        args: {
          shouldFail: t.arg.boolean(),
        },
        resolve: (_, args) => {
          if (args.shouldFail) {
            throw new Error('This should NOT be caught');
          }
          return { a: 'value' };
        },
      }),
    }),
  });

  const schema = builder.toSchema();

  it('does not catch errors for regular unions', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getRegular(shouldFail: true) {
            __typename
            ... on TypeA {
              a
            }
            ... on TypeB {
              b
            }
          }
        }
      `),
    });

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toBe('This should NOT be caught');
  });
});

describe('builder.errorUnion method', () => {
  class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }

  class ValidationError extends Error {
    field: string;
    constructor(message: string, field: string) {
      super(message);
      this.field = field;
      this.name = 'ValidationError';
    }
  }

  it('creates error union with automatic resolveType', async () => {
    const builder = new SchemaBuilder({
      plugins: [ErrorsPlugin],
      errors: {
        defaultTypes: [],
      },
    });

    const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.objectType(NotFoundError, {
      name: 'NotFoundError',
      interfaces: [ErrorInterface],
      isTypeOf: (value) => value instanceof NotFoundError,
    });

    builder.objectType(ValidationError, {
      name: 'ValidationError',
      interfaces: [ErrorInterface],
      isTypeOf: (value) => value instanceof ValidationError,
      fields: (t) => ({
        field: t.exposeString('field'),
      }),
    });

    const UserType = builder.objectRef<{ id: string; name: string }>('User').implement({
      isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj,
      fields: (t) => ({
        id: t.exposeString('id'),
        name: t.exposeString('name'),
      }),
    });

    // Use builder.errorUnion - no manual resolveType needed
    const UserResult = builder.errorUnion('UserResult', {
      types: [UserType, NotFoundError, ValidationError],
    });

    builder.queryType({
      fields: (t) => ({
        getUser: t.field({
          type: UserResult,
          args: {
            id: t.arg.string({ required: true }),
            shouldFail: t.arg.string(),
          },
          resolve: (_, args) => {
            if (args.shouldFail === 'notFound') {
              throw new NotFoundError('User not found');
            }
            if (args.shouldFail === 'validation') {
              throw new ValidationError('Invalid ID', 'id');
            }
            return { id: args.id, name: 'Test User' };
          },
        }),
      }),
    });

    const schema = builder.toSchema();

    // Test success
    const successResult = await execute({
      schema,
      document: parse(`
        query {
          getUser(id: "123") {
            __typename
            ... on User { id name }
          }
        }
      `),
    });
    expect(successResult.data?.getUser).toEqual({
      __typename: 'User',
      id: '123',
      name: 'Test User',
    });

    // Test NotFoundError
    const notFoundResult = await execute({
      schema,
      document: parse(`
        query {
          getUser(id: "123", shouldFail: "notFound") {
            __typename
            ... on NotFoundError { message }
          }
        }
      `),
    });
    expect(notFoundResult.data?.getUser).toEqual({
      __typename: 'NotFoundError',
      message: 'User not found',
    });

    // Test ValidationError
    const validationResult = await execute({
      schema,
      document: parse(`
        query {
          getUser(id: "123", shouldFail: "validation") {
            __typename
            ... on ValidationError { message field }
          }
        }
      `),
    });
    expect(validationResult.data?.getUser).toEqual({
      __typename: 'ValidationError',
      message: 'Invalid ID',
      field: 'id',
    });
  });

  it('includes defaultTypes unless omitDefaultTypes is true', async () => {
    const builder = new SchemaBuilder({
      plugins: [ErrorsPlugin],
      errors: {
        defaultTypes: [Error],
      },
    });

    const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.objectType(Error, {
      name: 'BaseError',
      interfaces: [ErrorInterface],
    });

    const UserType = builder.objectRef<{ id: string }>('User').implement({
      isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'id' in obj,
      fields: (t) => ({
        id: t.exposeString('id'),
      }),
    });

    // Without omitDefaultTypes - should include Error from defaultTypes
    const UserResult = builder.errorUnion('UserResult', {
      types: [UserType],
    });

    builder.queryType({
      fields: (t) => ({
        getUser: t.field({
          type: UserResult,
          args: { shouldFail: t.arg.boolean() },
          resolve: (_, args) => {
            if (args.shouldFail) {
              throw new Error('Something went wrong');
            }
            return { id: '1' };
          },
        }),
      }),
    });

    const schema = builder.toSchema();

    const result = await execute({
      schema,
      document: parse(`
        query {
          getUser(shouldFail: true) {
            __typename
            ... on BaseError { message }
          }
        }
      `),
    });

    expect(result.data?.getUser).toEqual({
      __typename: 'BaseError',
      message: 'Something went wrong',
    });
  });

  it('omits defaultTypes when omitDefaultTypes is true', async () => {
    const builder = new SchemaBuilder({
      plugins: [ErrorsPlugin],
      errors: {
        defaultTypes: [Error],
      },
    });

    const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.objectType(Error, {
      name: 'BaseError',
      interfaces: [ErrorInterface],
    });

    builder.objectType(NotFoundError, {
      name: 'NotFoundError',
      interfaces: [ErrorInterface],
      isTypeOf: (value) => value instanceof NotFoundError,
    });

    const UserType = builder.objectRef<{ id: string }>('User').implement({
      isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'id' in obj,
      fields: (t) => ({
        id: t.exposeString('id'),
      }),
    });

    // With omitDefaultTypes: true - should NOT include Error from defaultTypes
    const UserResult = builder.errorUnion('UserResult', {
      types: [UserType, NotFoundError],
      omitDefaultTypes: true,
    });

    builder.queryType({
      fields: (t) => ({
        getUser: t.field({
          type: UserResult,
          args: { shouldFail: t.arg.string() },
          resolve: (_, args) => {
            if (args.shouldFail === 'notFound') {
              throw new NotFoundError('Not found');
            }
            if (args.shouldFail === 'base') {
              // This should NOT be caught since Error is omitted
              throw new Error('Base error');
            }
            return { id: '1' };
          },
        }),
      }),
    });

    const schema = builder.toSchema();

    // NotFoundError should still be caught
    const notFoundResult = await execute({
      schema,
      document: parse(`
        query {
          getUser(shouldFail: "notFound") {
            __typename
            ... on NotFoundError { message }
          }
        }
      `),
    });
    expect(notFoundResult.data?.getUser).toEqual({
      __typename: 'NotFoundError',
      message: 'Not found',
    });

    // Base Error should NOT be caught (will appear in errors array)
    const baseResult = await execute({
      schema,
      document: parse(`
        query {
          getUser(shouldFail: "base") {
            __typename
          }
        }
      `),
    });
    expect(baseResult.errors).toBeDefined();
    expect(baseResult.errors?.[0]?.message).toBe('Base error');
  });

  it('supports custom resolveType', async () => {
    const builder = new SchemaBuilder({
      plugins: [ErrorsPlugin],
      errors: {
        defaultTypes: [],
      },
    });

    // Type without isTypeOf - needs custom resolveType
    const SuccessType = builder.objectRef<{ success: true; data: string }>('Success').implement({
      fields: (t) => ({
        data: t.exposeString('data'),
      }),
    });

    const FailureType = builder.objectRef<{ success: false; reason: string }>('Failure').implement({
      fields: (t) => ({
        reason: t.exposeString('reason'),
      }),
    });

    const ResultUnion = builder.errorUnion('Result', {
      types: [SuccessType, FailureType],
      resolveType: (value) => {
        if (typeof value === 'object' && value !== null && 'success' in value) {
          return value.success ? 'Success' : 'Failure';
        }
        return undefined;
      },
    });

    builder.queryType({
      fields: (t) => ({
        getResult: t.field({
          type: ResultUnion,
          args: { succeed: t.arg.boolean({ required: true }) },
          resolve: (_, args) => {
            if (args.succeed) {
              return { success: true as const, data: 'It worked!' };
            }
            return { success: false as const, reason: 'It failed' };
          },
        }),
      }),
    });

    const schema = builder.toSchema();

    const successResult = await execute({
      schema,
      document: parse(`
        query {
          getResult(succeed: true) {
            __typename
            ... on Success { data }
          }
        }
      `),
    });
    expect(successResult.data?.getResult).toEqual({
      __typename: 'Success',
      data: 'It worked!',
    });

    const failureResult = await execute({
      schema,
      document: parse(`
        query {
          getResult(succeed: false) {
            __typename
            ... on Failure { reason }
          }
        }
      `),
    });
    expect(failureResult.data?.getResult).toEqual({
      __typename: 'Failure',
      reason: 'It failed',
    });
  });
});

describe('explicit errors option takes precedence', () => {
  class CustomError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
      this.name = 'CustomError';
    }
  }

  const builder = new SchemaBuilder({
    plugins: [ErrorsPlugin],
    errors: {
      defaultTypes: [],
    },
  });

  const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
    fields: (t) => ({
      message: t.exposeString('message'),
    }),
  });

  builder.objectType(Error, {
    name: 'BaseError',
    interfaces: [ErrorInterface],
  });

  builder.objectType(CustomError, {
    name: 'CustomError',
    interfaces: [ErrorInterface],
    isTypeOf: (value) => value instanceof CustomError,
    fields: (t) => ({
      code: t.exposeInt('code'),
    }),
  });

  const UserType = builder.objectRef<{ id: string }>('User').implement({
    isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'id' in obj,
    fields: (t) => ({
      id: t.exposeString('id'),
    }),
  });

  // Error union (defined but not used in this test - testing that explicit errors option takes precedence)
  builder.errorUnion('UserResult', {
    types: [UserType, Error],
  });

  builder.queryType({
    fields: (t) => ({
      // Field with explicit errors option - should use that instead
      getUser: t.field({
        type: UserType,
        errors: {
          types: [CustomError],
        },
        args: {
          shouldFail: t.arg.boolean(),
        },
        resolve: (_, args) => {
          if (args.shouldFail) {
            throw new CustomError('Custom error', 42);
          }
          return { id: '1' };
        },
      }),
    }),
  });

  const schema = builder.toSchema();

  it('uses explicit errors option instead of error union', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getUser(shouldFail: true) {
            __typename
            ... on QueryGetUserSuccess {
              data {
                id
              }
            }
            ... on CustomError {
              message
              code
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getUser": {
            "__typename": "CustomError",
            "code": 42,
            "message": "Custom error",
          },
        },
      }
    `);
  });
});

describe('nested arrays with itemErrors', () => {
  class ItemError extends Error {
    index: number;
    constructor(message: string, index: number) {
      super(message);
      this.index = index;
      this.name = 'ItemError';
    }
  }

  const builder = new SchemaBuilder({
    plugins: [ErrorsPlugin],
    errors: {
      defaultTypes: [],
    },
  });

  const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
    fields: (t) => ({
      message: t.exposeString('message'),
    }),
  });

  builder.objectType(ItemError, {
    name: 'ItemError',
    interfaces: [ErrorInterface],
    isTypeOf: (value) => value instanceof ItemError,
    fields: (t) => ({
      index: t.exposeInt('index'),
    }),
  });

  const ItemType = builder.objectRef<{ value: number }>('Item').implement({
    isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'value' in obj,
    fields: (t) => ({
      value: t.exposeInt('value'),
    }),
  });

  const ItemResult = builder.errorUnion('ItemResult', {
    types: [ItemType, ItemError],
  });

  builder.queryType({
    fields: (t) => ({
      // 2D array - [[Item | Error]]
      get2DArray: t.field({
        type: t.listRef(t.listRef(ItemResult)),
        resolve: () => [
          [{ value: 1 }, { value: 2 }, new ItemError('Error in row 0', 2)],
          [{ value: 3 }, new ItemError('Error in row 1', 1), { value: 5 }],
          [{ value: 6 }, { value: 7 }, { value: 8 }],
        ],
      }),

      // 3D array - [[[Item | Error]]]
      get3DArray: t.field({
        type: t.listRef(t.listRef(t.listRef(ItemResult))),
        resolve: () => [
          [
            [{ value: 1 }, new ItemError('Deep error', 1)],
            [{ value: 3 }, { value: 4 }],
          ],
          [
            [new ItemError('Another deep error', 0), { value: 6 }],
            [{ value: 7 }, { value: 8 }],
          ],
        ],
      }),

      // Mixed nesting with errors at different levels
      getMixedNesting: t.field({
        type: t.listRef(t.listRef(ItemResult)),
        resolve: () => [
          [{ value: 1 }],
          [new ItemError('Single error row', 0)],
          [{ value: 2 }, { value: 3 }, new ItemError('Error at end', 2)],
        ],
      }),
    }),
  });

  const schema = builder.toSchema();

  it('handles 2D arrays with errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          get2DArray {
            __typename
            ... on Item {
              value
            }
            ... on ItemError {
              message
              index
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "get2DArray": [
            [
              {
                "__typename": "Item",
                "value": 1,
              },
              {
                "__typename": "Item",
                "value": 2,
              },
              {
                "__typename": "ItemError",
                "index": 2,
                "message": "Error in row 0",
              },
            ],
            [
              {
                "__typename": "Item",
                "value": 3,
              },
              {
                "__typename": "ItemError",
                "index": 1,
                "message": "Error in row 1",
              },
              {
                "__typename": "Item",
                "value": 5,
              },
            ],
            [
              {
                "__typename": "Item",
                "value": 6,
              },
              {
                "__typename": "Item",
                "value": 7,
              },
              {
                "__typename": "Item",
                "value": 8,
              },
            ],
          ],
        },
      }
    `);
  });

  it('handles 3D arrays with errors', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          get3DArray {
            __typename
            ... on Item {
              value
            }
            ... on ItemError {
              message
              index
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "get3DArray": [
            [
              [
                {
                  "__typename": "Item",
                  "value": 1,
                },
                {
                  "__typename": "ItemError",
                  "index": 1,
                  "message": "Deep error",
                },
              ],
              [
                {
                  "__typename": "Item",
                  "value": 3,
                },
                {
                  "__typename": "Item",
                  "value": 4,
                },
              ],
            ],
            [
              [
                {
                  "__typename": "ItemError",
                  "index": 0,
                  "message": "Another deep error",
                },
                {
                  "__typename": "Item",
                  "value": 6,
                },
              ],
              [
                {
                  "__typename": "Item",
                  "value": 7,
                },
                {
                  "__typename": "Item",
                  "value": 8,
                },
              ],
            ],
          ],
        },
      }
    `);
  });

  it('handles mixed nesting with errors at different positions', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          getMixedNesting {
            __typename
            ... on Item {
              value
            }
            ... on ItemError {
              message
              index
            }
          }
        }
      `),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "getMixedNesting": [
            [
              {
                "__typename": "Item",
                "value": 1,
              },
            ],
            [
              {
                "__typename": "ItemError",
                "index": 0,
                "message": "Single error row",
              },
            ],
            [
              {
                "__typename": "Item",
                "value": 2,
              },
              {
                "__typename": "Item",
                "value": 3,
              },
              {
                "__typename": "ItemError",
                "index": 2,
                "message": "Error at end",
              },
            ],
          ],
        },
      }
    `);
  });
});
