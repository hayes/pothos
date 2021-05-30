import { execute, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './example/schema';

describe('example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  describe('query', () => {
    it('returns expected result', async () => {
      const query = gql`
        query {
          exampleQuery(input: { id: "123" }) {
            id
          }
          withOptions(custom: { id: "123" }) {
            id
          }
          obj {
            exampleObjectField(input: { id: "123" }) {
              id
            }
            withOptions(custom: { id: "123" }) {
              id
            }
          }
          iface {
            __typename
            exampleInterfaceField(input: { id: "123" }) {
              id
            }
            withOptions(custom: { id: "123" }) {
              id
            }
          }
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
            "exampleQuery": "123",
            "iface": Object {
              "__typename": "ObjWithInterface",
              "exampleInterfaceField": "123",
              "withOptions": "123",
            },
            "obj": Object {
              "exampleObjectField": "123",
              "withOptions": "123",
            },
            "withOptions": "123",
          },
        }
      `);
    });
  });

  describe('mutations', () => {
    it('returns expected result', async () => {
      const query = gql`
        mutation {
          exampleMutation(input: { id: "123" }) {
            id
          }
          withOptions(custom: { id: "123" }) {
            id
          }
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
            "exampleMutation": "123",
            "withOptions": "123",
          },
        }
      `);
    });
  });
});
