import { gql } from 'apollo-server';
import { execute } from 'graphql';
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
          [GraphQLError: [
        {
          "code": "custom",
          "message": "number must be odd",
          "path": [
            "odd"
          ]
        },
        {
          "code": "custom",
          "message": "Invalid input",
          "path": [
            "enum1"
          ]
        },
        {
          "code": "custom",
          "message": "no example.com email addresses",
          "path": [
            "contactInfo",
            "email"
          ]
        },
        {
          "code": "invalid_union",
          "unionErrors": [
            {
              "issues": [
                {
                  "validation": "regex",
                  "code": "invalid_string",
                  "message": "Invalid",
                  "path": [
                    "contactInfo",
                    "phone"
                  ]
                },
                {
                  "code": "too_small",
                  "minimum": 12,
                  "type": "string",
                  "inclusive": true,
                  "message": "Should be at least 12 characters",
                  "path": [
                    "contactInfo",
                    "phone"
                  ]
                }
              ]
            },
            {
              "issues": [
                {
                  "validation": "regex",
                  "code": "invalid_string",
                  "message": "Invalid",
                  "path": [
                    "contactInfo",
                    "phone"
                  ]
                },
                {
                  "code": "invalid_type",
                  "expected": "array",
                  "received": "string",
                  "path": [
                    "contactInfo",
                    "phone"
                  ],
                  "message": "Expected array, received string"
                }
              ]
            }
          ],
          "path": [
            "contactInfo",
            "phone"
          ],
          "message": "Invalid input"
        },
        {
          "code": "invalid_union",
          "unionErrors": [
            {
              "issues": [
                {
                  "code": "custom",
                  "message": "Name should be capitalized",
                  "path": [
                    "contactInfo",
                    "name"
                  ]
                }
              ]
            },
            {
              "issues": [
                {
                  "code": "invalid_type",
                  "expected": "array",
                  "received": "string",
                  "path": [
                    "contactInfo",
                    "name"
                  ],
                  "message": "Expected array, received string"
                }
              ]
            }
          ],
          "path": [
            "contactInfo",
            "name"
          ],
          "message": "Invalid input"
        },
        {
          "code": "custom",
          "message": "Aliases should be capitalized",
          "path": [
            "contactInfo",
            "aliases"
          ]
        },
        {
          "code": "custom",
          "message": "Invalid input",
          "path": [
            "recursive",
            "float"
          ]
        },
        {
          "code": "too_big",
          "maximum": 5,
          "type": "number",
          "inclusive": true,
          "message": "Value should be less than or equal to 5",
          "path": [
            "recursive",
            "recurse",
            "number"
          ]
        },
        {
          "code": "custom",
          "message": "Invalid input",
          "path": [
            "recursive",
            "recurse",
            "float"
          ]
        },
        {
          "code": "custom",
          "message": "number must not be 3",
          "path": [
            "recursive",
            "recurse",
            "recurse"
          ]
        }
      ]],
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
          [GraphQLError: [
        {
          "validation": "email",
          "code": "invalid_string",
          "message": "Invalid email",
          "path": [
            "email"
          ]
        }
      ]],
          [GraphQLError: [
        {
          "validation": "email",
          "code": "invalid_string",
          "message": "invalid email address",
          "path": [
            "email"
          ]
        }
      ]],
          [GraphQLError: [
        {
          "code": "custom",
          "message": "Must provide either phone number or email address",
          "path": []
        }
      ]],
          [GraphQLError: [
        {
          "code": "custom",
          "message": "Invalid input",
          "path": []
        }
      ]],
          [GraphQLError: [
        {
          "code": "invalid_union",
          "unionErrors": [
            {
              "issues": [
                {
                  "code": "too_big",
                  "maximum": 3,
                  "type": "string",
                  "inclusive": true,
                  "message": "Should be at most 3 characters long",
                  "path": [
                    "list",
                    0
                  ]
                }
              ]
            },
            {
              "issues": [
                {
                  "code": "invalid_type",
                  "expected": "array",
                  "received": "string",
                  "path": [
                    "list",
                    0
                  ],
                  "message": "Expected array, received string"
                }
              ]
            }
          ],
          "path": [
            "list",
            0
          ],
          "message": "Invalid input"
        }
      ]],
          [GraphQLError: [
        {
          "code": "too_big",
          "maximum": 3,
          "type": "array",
          "inclusive": true,
          "message": "Should have at most 3 items",
          "path": [
            "list"
          ]
        }
      ]],
        ],
      }
    `);
  });
});
