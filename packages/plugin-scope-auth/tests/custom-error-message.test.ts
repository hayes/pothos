import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import exampleSchema from './example/schema';
import customErrorSchema from './example/schema/custom-errors';

describe('custom error messages', () => {
  it('custom errors on field', async () => {
    const query = gql`
      query {
        customError
        customErrorMessage
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "customError": null,
          "customErrorMessage": null,
        },
        "errors": Array [
          [GraphQLError: AuthScopeFunction: Not authorized to resolve Query.customError],
          [GraphQLError: AuthScopeFunction: Not authorized to resolve Query.customErrorMessage],
        ],
      }
    `);
  });

  it('custom errors on builder', async () => {
    const query = gql`
      query {
        test
      }
    `;

    const result = await execute({
      schema: customErrorSchema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "test": null,
        },
        "errors": Array [
          [GraphQLError: AuthScopeFunction: Not authorized to resolve Query.test],
        ],
      }
    `);
  });
});
