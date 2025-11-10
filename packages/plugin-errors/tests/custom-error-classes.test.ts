import SchemaBuilder from '@pothos/core';
import { execute, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import ErrorPlugin from '../src';

describe('custom error classes that do not extend Error', () => {
  it('handles custom non-Error classes in error fields', async () => {
    class CustomNonErrorClass {
      message: string;
      code: number;

      constructor(message: string, code: number) {
        this.message = message;
        this.code = code;
      }
    }

    const builder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [],
      },
    });

    const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.objectType(CustomNonErrorClass, {
      name: 'CustomNonErrorClass',
      fields: (t) => ({
        message: t.exposeString('message'),
        code: t.exposeInt('code'),
      }),
    });

    builder.objectType(Error, {
      name: 'BaseError',
      interfaces: [ErrorInterface],
    });

    builder.queryType({
      fields: (t) => ({
        testField: t.string({
          errors: {
            types: [CustomNonErrorClass, Error],
          },
          args: {
            throwCustom: t.arg.boolean(),
            throwError: t.arg.boolean(),
          },
          resolve: (_root, args) => {
            if (args.throwCustom) {
              throw new CustomNonErrorClass('Custom non-error message', 404);
            }
            if (args.throwError) {
              throw new Error('Regular error message');
            }
            return 'success';
          },
        }),
      }),
    });

    const schema = builder.toSchema();

    expect(printSchema(schema)).toMatchInlineSnapshot(`
      "type BaseError implements Error {
        message: String
      }

      type CustomNonErrorClass {
        code: Int
        message: String
      }

      interface Error {
        message: String
      }

      type Query {
        testField(throwCustom: Boolean, throwError: Boolean): QueryTestFieldResult
      }

      union QueryTestFieldResult = BaseError | CustomNonErrorClass | QueryTestFieldSuccess

      type QueryTestFieldSuccess {
        data: String!
      }"
    `);

    const successResult = await execute({
      schema,
      document: gql`
        query {
          testField {
            __typename
            ... on QueryTestFieldSuccess {
              data
            }
            ... on Error {
              message
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(successResult).toMatchInlineSnapshot(`
      {
        "data": {
          "testField": {
            "__typename": "QueryTestFieldSuccess",
            "data": "success",
          },
        },
      }
    `);

    const errorResult = await execute({
      schema,
      document: gql`
        query {
          testField(throwError: true) {
            __typename
            ... on QueryTestFieldSuccess {
              data
            }
            ... on Error {
              message
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(errorResult).toMatchInlineSnapshot(`
      {
        "data": {
          "testField": {
            "__typename": "BaseError",
            "message": "Regular error message",
          },
        },
      }
    `);

    const customErrorResult = await execute({
      schema,
      document: gql`
        query {
          testField(throwCustom: true) {
            __typename
            ... on QueryTestFieldSuccess {
              data
            }
            ... on Error {
              message
            }
            ... on CustomNonErrorClass {
              message
              code
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(customErrorResult).toMatchInlineSnapshot(`
      {
        "data": {
          "testField": {
            "__typename": "CustomNonErrorClass",
            "code": 404,
            "message": "Custom non-error message",
          },
        },
      }
    `);
  });

  it('handles both Error-extending and non-Error classes', async () => {
    class ExtendsError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ExtendsError';
      }
    }

    class DoesNotExtendError {
      message: string;
      code: number;
      constructor(message: string, code: number) {
        this.message = message;
        this.code = code;
      }
    }

    const builder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [],
      },
    });

    const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.objectType(ExtendsError, {
      name: 'ExtendsError',
      interfaces: [ErrorInterface],
    });

    builder.objectType(DoesNotExtendError, {
      name: 'DoesNotExtendError',
      fields: (t) => ({
        message: t.exposeString('message'),
        code: t.exposeInt('code'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        testField: t.string({
          errors: {
            types: [ExtendsError, DoesNotExtendError],
          },
          args: {
            throwExtends: t.arg.boolean(),
            throwCustom: t.arg.boolean(),
          },
          resolve: (_root, args) => {
            if (args.throwExtends) {
              throw new ExtendsError('Error that extends Error');
            }
            if (args.throwCustom) {
              throw new DoesNotExtendError('Custom non-error class', 500);
            }
            return 'success';
          },
        }),
      }),
    });

    const schema = builder.toSchema();

    const extendsErrorResult = await execute({
      schema,
      document: gql`
        query {
          testField(throwExtends: true) {
            __typename
            ... on QueryTestFieldSuccess {
              data
            }
            ... on ExtendsError {
              message
            }
            ... on DoesNotExtendError {
              message
              code
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(extendsErrorResult).toMatchInlineSnapshot(`
      {
        "data": {
          "testField": {
            "__typename": "ExtendsError",
            "message": "Error that extends Error",
          },
        },
      }
    `);

    const customErrorResult = await execute({
      schema,
      document: gql`
        query {
          testField(throwCustom: true) {
            __typename
            ... on QueryTestFieldSuccess {
              data
            }
            ... on ExtendsError {
              message
            }
            ... on DoesNotExtendError {
              message
              code
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(customErrorResult).toMatchInlineSnapshot(`
      {
        "data": {
          "testField": {
            "__typename": "DoesNotExtendError",
            "code": 500,
            "message": "Custom non-error class",
          },
        },
      }
    `);
  });
});
