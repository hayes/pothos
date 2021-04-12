import { gql } from 'apollo-server';
import { execute } from 'graphql';
import schema from './example/schema';

describe('validation', () => {
  test('valid query', async () => {
    const query = gql`
      query {
        exampleField(
          odd: 1
          recursive: { float: 1.1, number: 2, recurse: { float: 1.1, number: 1 } }
          contactInfo: { name: "Michael", email: "michael@test.com", aliases: ["Hayes", "MHayes"] }
          enum1: [One, Two]
        )
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "exampleField": 1,
        },
      }
    `);
  });

  test('invalid query', async () => {
    const query = gql`
      query {
        exampleField(
          odd: 2
          recursive: { float: 1, number: 2, recurse: { float: 1, number: 6 } }
          contactInfo: { name: "michael", email: "michael@example.com", aliases: ["hayes"] }
          enum1: [Two, One]
        )
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: 9 validation issue(s)

        Issue #0: custom_error at enum1
        Invalid value.

        Issue #1: custom_error at recursive.float
        Invalid value.

        Issue #2: too_big at recursive.recurse.number
        Value should be less than or equal to 5

        Issue #3: custom_error at recursive.recurse.float
        Invalid value.

        Issue #4: custom_error at odd
        number must be odd

        Issue #5: custom_error at contactInfo.name
        Name should be capitalized

        Issue #6: custom_error at contactInfo.aliases
        Aliases should be capitalized

        Issue #7: custom_error at contactInfo.email
        no example.com email addresses

        Issue #8: custom_error at contactInfo.aliases
        contactInfo should include at least 2 aliases
      ],
        ],
      }
    `);
  });
});
