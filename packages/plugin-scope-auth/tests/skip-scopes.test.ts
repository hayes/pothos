import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import exampleSchema from './example/schema';
import User from './example/user';

describe('query', () => {
  it('object with field that skips type scopes', async () => {
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
        user: new User({
          'x-user-id': '1',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjWithSkipFields": {
            "skip": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to resolve ObjWithSkipFields.skip],
        ],
      }
    `);
  });

  it('object with field that skips interface type scopes', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjWithIfaceSkipFields": {
            "skipBoth": "ok",
            "skipIface": null,
            "skipType": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for IfaceForAdmin],
          [GraphQLError: Not authorized to read fields for ObjWithIfaceSkipFields],
        ],
      }
    `);
  });
});
