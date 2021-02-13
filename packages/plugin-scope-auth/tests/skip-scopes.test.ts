import { gql } from 'apollo-server';
import { execute } from 'graphql';
import exampleSchema from './example/schema';
import User from './example/user';

describe('query', () => {
  test('object with field that skips type scopes', async () => {
    const query = gql`
      query {
        ObjWithSkipFields {
          skip
        }
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjWithSkipFields": Object {
            "skip": null,
          },
        },
        "errors": Array [
          [GraphQLError: Not authorized to resolve ObjWithSkipFields.skip],
        ],
      }
    `);
  });

  test('object with field that skips interface type scopes', async () => {
    const query = gql`
      query {
        ObjWithIfaceSkipFields {
          skipType
          skipIface
          skipBoth
        }
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjWithIfaceSkipFields": Object {
            "skipBoth": "ok",
            "skipIface": null,
            "skipType": null,
          },
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for IfaceForAdmin],
          [GraphQLError: Not authorized to read fields for ObjWithIfaceSkipFields],
        ],
      }
    `);
  });
});
