import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { ZodError } from 'zod';
import ErrorPlugin from '../src';

describe('ZodError regression test', () => {
  it('should include ZodError in union types', async () => {
    const builder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [],
      },
    });

    // Define ZodError as an error type
    builder.objectType(ZodError, {
      name: 'ZodError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        testField: t.string({
          errors: {
            types: [ZodError],
          },
          resolve: () => {
            throw new ZodError([{ code: 'invalid_type', expected: 'string', received: 'number', path: ['test'], message: 'Test error' }]);
          },
        }),
      }),
    });

    const schema = builder.toSchema();

    // Check that the union includes ZodError
    const queryType = schema.getType('Query');
    if (queryType && 'getFields' in queryType) {
      const testField = queryType.getFields()['testField'];
      const returnType = testField?.type;
      
      console.log('Return type:', returnType);
      console.log('Return type toString:', returnType?.toString());
      
      // The return type should be a union that includes ZodError
      expect(returnType?.toString()).toContain('ZodError');
    }

    const result = await execute({
      schema,
      document: gql`
        query {
          testField {
            __typename
            ... on ZodError {
              message
            }
          }
        }
      `,
      contextValue: {},
    });

    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.data?.testField.__typename).toBe('ZodError');
  });
});
