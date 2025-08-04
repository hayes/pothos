import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './example/schema';

describe('Basic Validation', () => {
  describe('argument validation', () => {
    it('validates individual field arguments', async () => {
      const validQuery = gql`
        query {
          simple(email: "test@example.com")
        }
      `;

      const validResult = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(validResult.data?.simple).toBe(true);
      expect(validResult.errors).toBeUndefined();

      const invalidQuery = gql`
        query {
          simple(email: "not-an-email")
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.simple).toBeNull();
      expect(invalidResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: email: Invalid email address",
            "path": [
              "simple",
            ],
          },
        ]
      `);
    });

    it('validates with custom error messages', async () => {
      const query = gql`
        query {
          withMessage(email: "invalid-email")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: email: invalid email address",
            "path": [
              "withMessage",
            ],
          },
        ]
      `);
    });

    it('validates list arguments', async () => {
      const validQuery = gql`
        query {
          list(list: ["ab", "cd", "ef"])
        }
      `;

      const validResult = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(validResult.data?.list).toBe(true);
      expect(validResult.errors).toBeUndefined();

      const invalidItemQuery = gql`
        query {
          list(list: ["abcd", "ef"])
        }
      `;

      const invalidItemResult = await execute({
        schema,
        document: invalidItemQuery,
        contextValue: {},
      });

      expect(invalidItemResult.data?.list).toBeNull();
      expect(invalidItemResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: list.0: Too big: expected string to have <=3 characters",
            "path": [
              "list",
            ],
          },
        ]
      `);

      const multipleInvalidQuery = gql`
        query {
          list(list: ["abcd", "efgh"])
        }
      `;

      const multipleInvalidResult = await execute({
        schema,
        document: multipleInvalidQuery,
        contextValue: {},
      });

      expect(multipleInvalidResult.data?.list).toBeNull();
      expect(multipleInvalidResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: list.0: Too big: expected string to have <=3 characters, list.1: Too big: expected string to have <=3 characters",
            "path": [
              "list",
            ],
          },
        ]
      `);
    });
  });

  describe('field-level validation', () => {
    it('validates field arguments using schema validation', async () => {
      const validQuery = gql`
        query {
          argsSchema(num: 3, string: "abc")
        }
      `;

      const validResult = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(validResult.data?.argsSchema).toBe(true);

      const invalidQuery = gql`
        query {
          argsSchema(num: 1, string: "a")
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.argsSchema).toBeNull();
      expect(invalidResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: num: Too small: expected number to be >=2, string: Too small: expected string to have >=2 characters",
            "path": [
              "argsSchema",
            ],
          },
        ]
      `);
    });

    it('validates cross-field constraints', async () => {
      const neitherProvidedQuery = gql`
        query {
          simple
        }
      `;

      const result = await execute({
        schema,
        document: neitherProvidedQuery,
        contextValue: {},
      });

      expect(result.data?.simple).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: : Invalid input",
            "path": [
              "simple",
            ],
          },
        ]
      `);
    });
  });

  describe('input type validation', () => {
    it('validates input type fields individually', async () => {
      const validQuery = gql`
        query {
          soloNested(input: { nested: { id: "12" } })
        }
      `;

      const validResult = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(validResult.data?.soloNested).toBe(true);

      const invalidQuery = gql`
        query {
          soloNested(input: { nested: { id: "1" } })
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.soloNested).toBeNull();
      expect(invalidResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input.nested.id: Too small: expected string to have >=2 characters",
            "path": [
              "soloNested",
            ],
          },
        ]
      `);
    });

    it('validates input type with whole-object validation', async () => {
      const validQuery = gql`
        query {
          withValidationInput(input: { name: "secret", age: 100 })
        }
      `;

      const validResult = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(validResult.data?.withValidationInput).toBe(true);

      const invalidQuery = gql`
        query {
          withValidationInput(input: { name: "wrong", age: 100 })
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.withValidationInput).toBeNull();
      expect(invalidResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input: Incorrect name given",
            "path": [
              "withValidationInput",
            ],
          },
        ]
      `);
    });

    it('validates arrays of input objects', async () => {
      const validQuery = gql`
        query {
          nestedObjectList(input: { nested: [{ id: "12" }, { id: "34" }] })
        }
      `;

      const validResult = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(validResult.data?.nestedObjectList).toBe(true);

      const invalidQuery = gql`
        query {
          nestedObjectList(input: { nested: [{ id: "1" }, { id: "34" }] })
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.nestedObjectList).toBeNull();
      expect(invalidResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input.nested.0.id: Too small: expected string to have >=2 characters",
            "path": [
              "nestedObjectList",
            ],
          },
        ]
      `);
    });

    it('validates input types with schema validation', async () => {
      const validQuery = gql`
        query {
          withSchemaInput(input: { name: "abc" })
        }
      `;

      const validResult = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(validResult.data?.withSchemaInput).toBe(true);

      const invalidQuery = gql`
        query {
          withSchemaInput(input: { name: "a" })
        }
      `;

      const invalidResult = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(invalidResult.data?.withSchemaInput).toBeNull();
      expect(invalidResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input.name: Too small: expected string to have >=2 characters",
            "path": [
              "withSchemaInput",
            ],
          },
        ]
      `);
    });

    it('uses aliased field names in error paths', async () => {
      const aliasedQuery = gql`
        query {
          aliasedField: soloNested(input: { nested: { id: "1" } })
        }
      `;

      const aliasedResult = await execute({
        schema,
        document: aliasedQuery,
        contextValue: {},
      });

      expect(aliasedResult.data?.aliasedField).toBeNull();
      expect(aliasedResult.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input.nested.id: Too small: expected string to have >=2 characters",
            "path": [
              "aliasedField",
            ],
          },
        ]
      `);
    });
  });
});
