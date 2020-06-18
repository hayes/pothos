import { printSchema, lexicographicSortSchema, execute } from 'graphql';
import { gql } from 'apollo-server';
import exampleSchema from './examples/simple/schema';
import { User } from './examples/simple/data';

describe('simple objects example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  describe('queries', () => {
    test('query some stuff', async () => {
      const query = gql`
        query {
          user(id: 1) {
            id
            firstName
            lastName
            contactInfo {
              email
              phoneNumber
            }
          }
        }
      `;

      const result = await execute({
        schema: exampleSchema,
        document: query,
        contextValue: {
          User,
        },
      });

      expect(result).toMatchSnapshot();
    });
  });
});
