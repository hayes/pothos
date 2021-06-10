import { gql } from 'apollo-server';
import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import { User } from './examples/simple/data';
import exampleSchema from './examples/simple/schema';

describe('simple objects example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  describe('queries', () => {
    it('query some stuff', async () => {
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
