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
          [GraphQLError: enum1: Invalid input, recursive.float: Invalid input, recursive.recurse.number: Too big: expected number to be <=5, recursive.recurse.float: Invalid input, recursive.recurse.recurse: number must not be 3, odd: number must be odd, contactInfo.aliases: Aliases should be capitalized, contactInfo.email: no example.com email addresses, contactInfo.phone: Invalid input, contactInfo.name: Name should be capitalized],
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
          [GraphQLError: list.0: Too big: expected string to have <=3 characters],
          [GraphQLError: list: Too big: expected array to have <=3 items],
          [GraphQLError: email: Invalid email address],
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
          [GraphQLError: input.nested.id: Too small: expected string to have >=2 characters],
          [GraphQLError: input.nested.0.id: Too small: expected string to have >=2 characters],
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
          [GraphQLError: num: Too small: expected number to be >=2, string: Too small: expected string to have >=2 characters],
          [GraphQLError: input.name: Too small: expected string to have >=2 characters],
          [GraphQLError: input.0.name: Too small: expected string to have >=2 characters],
        ],
      }
    `);
  });
});
