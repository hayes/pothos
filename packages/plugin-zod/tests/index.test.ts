import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './example/schema';

describe('validation', () => {
  it('valid query', async () => {
    const query = gql`
      query {
        exampleField(
          odd: 1
          recursive: { float: 1.1, number: 2, recurse: { float: 1.1, number: 1 } }
          contactInfo: {
            name: "Michael"
            email: "michael@test.com"
            phone: " 555-123-4567 "
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
      {
        "data": {
          "exampleField": 1,
        },
      }
    `);
  });

  it('invalid query', async () => {
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
            phone: " 555-123-456 "
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
      {
        "data": {
          "exampleField": null,
        },
        "errors": [
          [GraphQLError: recursive.recurse.number: Number must be less than or equal to 5, recursive.float: Invalid input, recursive.recurse.float: Invalid input, odd: number must be odd, contactInfo.email: no example.com email addresses, enum1: Invalid input, contactInfo.phone: Invalid, contactInfo.aliases: Aliases should be capitalized, contactInfo.name: Name should be capitalized, recursive.recurse.recurse: number must not be 3, contactInfo.aliases: contactInfo should include at least 2 aliases],
        ],
      }
    `);
  });

  it('example queries', async () => {
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
      {
        "data": {
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
        "errors": [
          [GraphQLError: email: invalid email address],
          [GraphQLError: : Must provide either phone number or email address],
          [GraphQLError: list.0: String must contain at most 3 character(s)],
          [GraphQLError: list: Array must contain at most 3 element(s)],
          [GraphQLError: email: Invalid email],
          [GraphQLError: : Invalid input],
        ],
      }
    `);
  });

  it('input object with schema', async () => {
    const query = gql`
      query {
        invalid: soloNested(input: { nested: { id: "1" } })
        valid: soloNested(input: { nested: { id: "12" } })
        invalidList: nestedObjectList(input: { nested: [{ id: "1" }] })
        validList: nestedObjectList(input: { nested: [{ id: "12" }] })
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
          "invalid": null,
          "invalidList": null,
          "valid": true,
          "validList": true,
        },
        "errors": [
          [GraphQLError: input.nested.id: String must contain at least 2 character(s)],
          [GraphQLError: input.nested.0.id: String must contain at least 2 character(s)],
        ],
      }
    `);
  });
  it('input object with input', async () => {
    const query = gql`
      query {
        withValidationInput(input: { name: "secret", age: 100 })
        withValidationInputInvalid: withValidationInput(input: { name: "not secret", age: 101 })
        withValidationInputInvalid2: withValidationInput(input: { name: "not secret", age: 100 })
        withValidationInputInvalid3: withValidationInput(input: { name: "secret", age: 101 })
        withValidationAndFieldValidator(input: { name: "secret", age: 100 })
        withValidationAndFieldValidatorInvalid: withValidationAndFieldValidator(
          input: { name: "not secret", age: 101 }
        )
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
          "withValidationAndFieldValidator": true,
          "withValidationAndFieldValidatorInvalid": null,
          "withValidationInput": true,
          "withValidationInputInvalid": null,
          "withValidationInputInvalid2": null,
          "withValidationInputInvalid3": null,
        },
        "errors": [
          [GraphQLError: input: Incorrect name given, input: Incorrect age given],
          [GraphQLError: input: Incorrect name given],
          [GraphQLError: input: Incorrect age given],
          [GraphQLError: input: Incorrect name given, input: Incorrect age given],
        ],
      }
    `);
  });

  it('schema on field', async () => {
    const query = gql`
      query {
        valid: argsSchema(num: 3, string: "abc")
        invalid: argsSchema(num: 1, string: "a")
        validInput: withSchemaInput(input: { name: "abc" })
        validInputList: withSchemaInputList(input: [{ name: "abc" }])
        invalidInput: withSchemaInput(input: { name: "a" })
        invalidInputList: withSchemaInputList(input: [{ name: "a" }])
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
          "invalid": null,
          "invalidInput": null,
          "invalidInputList": null,
          "valid": true,
          "validInput": true,
          "validInputList": true,
        },
        "errors": [
          [GraphQLError: num: Number must be greater than or equal to 2, string: String must contain at least 2 character(s)],
          [GraphQLError: input.name: String must contain at least 2 character(s)],
          [GraphQLError: input.0.name: String must contain at least 2 character(s)],
        ],
      }
    `);
  });
});
