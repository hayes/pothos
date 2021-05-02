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
          contactInfo: {
            name: "Michael"
            email: "michael@test.com"
            phone: "555-123-4567"
            aliases: ["Hayes", "MHayes"]
          }
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
          recursive: {
            float: 1
            number: 2
            recurse: { float: 1, number: 6, recurse: { float: 1.1, number: 3 } }
          }
          contactInfo: {
            name: "michael"
            email: "michael@example.com"
            phone: "555-123-456"
            aliases: ["hayes"]
          }
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
          [GraphQLError: 11 validation issue(s)

        Issue #0: custom_error at enum1
        Invalid value.

        Issue #1: custom_error at recursive.float
        Invalid value.

        Issue #2: too_big at recursive.recurse.number
        Value should be less than or equal to 5

        Issue #3: custom_error at recursive.recurse.float
        Invalid value.

        Issue #4: custom_error at recursive.recurse.recurse
        number must not be 3

        Issue #5: custom_error at odd
        number must be odd

        Issue #6: custom_error at contactInfo.name
        Name should be capitalized

        Issue #7: custom_error at contactInfo.aliases
        Aliases should be capitalized

        Issue #8: custom_error at contactInfo.email
        no example.com email addresses

        Issue #9: invalid_union at contactInfo.phone
        Invalid input

        Issue #10: custom_error at contactInfo.aliases
        contactInfo should include at least 2 aliases
      ],
        ],
      }
    `);
  });

  test('example queries', async () => {
    const query = gql`
      query {
        simpleValid: simple(email: "abc@def.com")
        simpleInvalid: simple(email: "abc")
        simpleInvalid2: simple
        messageValid: withMessage(email: "abc@def.com")
        messageInvalid: withMessage(email: "abc")
        messageInvalid2: withMessage
        listValid: list(list: ["abc", "def", "ghi"])
        listInvalid: list(list: ["abcdef", "ghi"])
        listInvalid2: list(list: ["a", "b", "c", "d"])
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
          "listInvalid": null,
          "listInvalid2": null,
          "listValid": true,
          "messageInvalid": null,
          "messageInvalid2": null,
          "messageValid": true,
          "simpleInvalid": null,
          "simpleInvalid2": null,
          "simpleValid": true,
        },
        "errors": Array [
          [GraphQLError: 1 validation issue(s)

        Issue #0: invalid_string at email
        Invalid email
      ],
          [GraphQLError: 1 validation issue(s)

        Issue #0: custom_error at 
        Invalid value.
      ],
          [GraphQLError: 1 validation issue(s)

        Issue #0: invalid_string at email
        invalid email address
      ],
          [GraphQLError: 1 validation issue(s)

        Issue #0: custom_error at 
        Must provide either phone number or email address
      ],
          [GraphQLError: 1 validation issue(s)

        Issue #0: too_big at list.0
        Should be at most 3 characters long
      ],
          [GraphQLError: 1 validation issue(s)

        Issue #0: too_big at list
        Should have at most 3 items
      ],
        ],
      }
    `);
  });
});
