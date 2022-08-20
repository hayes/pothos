import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import customErrorSchema from './example/schema/custom-errors';
import User from './example/user';

describe('runScopesOnType', () => {
  it('authorized', async () => {
    const query = gql`
      query {
        me {
          id
        }
        me2 {
          id
        }
      }
    `;

    const result = await execute({
      schema: customErrorSchema,
      document: query,
      contextValue: {
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "id": "1",
          },
          "me2": {
            "id": "1",
          },
        },
      }
    `);
  });

  it('unauthorized', async () => {
    const query = gql`
      query {
        me {
          id
        }
        me2 {
          id
        }
      }
    `;

    const result = await execute({
      schema: customErrorSchema,
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
          "me": null,
          "me2": {
            "id": null,
          },
        },
        "errors": [
          [GraphQLError: AnyAuthScopes: Not authorized to read fields for User],
          [GraphQLError: AnyAuthScopes: Not authorized to read fields for User2],
        ],
      }
    `);
  });
});
