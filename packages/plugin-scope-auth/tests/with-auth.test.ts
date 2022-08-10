import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import exampleSchema from './example/schema';
import User from './example/user';

describe('withAuth', () => {
  it('withAuth authorized query', async () => {
    const query = gql`
      query {
        withAuth
        withAuthPrismaUser {
          id
          firstName
        }
        withAuthObject {
          withAuth
          withAuthFromInterface
        }
        post {
          id
          withAUthOnPrismaObject
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
      Object {
        "data": Object {
          "post": Object {
            "id": "1",
            "withAUthOnPrismaObject": true,
          },
          "withAuth": true,
          "withAuthObject": Object {
            "withAuth": true,
            "withAuthFromInterface": true,
          },
          "withAuthPrismaUser": Object {
            "firstName": "Maurine",
            "id": "1",
          },
        },
      }
    `);
  });
  it('withAuth unauthorized query', async () => {
    const query = gql`
      query {
        withAuth
        withAuthPrismaUser {
          id
          firstName
        }
        withAuthObject {
          withAuth
          withAuthFromInterface
        }
        post {
          id
          withAUthOnPrismaObject
        }
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "post": Object {
            "id": "1",
            "withAUthOnPrismaObject": null,
          },
          "withAuth": null,
          "withAuthObject": Object {
            "withAuth": null,
            "withAuthFromInterface": null,
          },
          "withAuthPrismaUser": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.withAuth],
          [GraphQLError: Not authorized to resolve Query.withAuthPrismaUser],
          [GraphQLError: Not authorized to resolve WithAuthObject.withAuth],
          [GraphQLError: Not authorized to resolve WithAuthObject.withAuthFromInterface],
          [GraphQLError: Not authorized to resolve Post.withAUthOnPrismaObject],
        ],
      }
    `);
  });

  it('withAuth authorized mutation', async () => {
    const query = gql`
      mutation {
        withAuth
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
      Object {
        "data": Object {
          "withAuth": true,
        },
      }
    `);
  });

  it('withAuth unauthorized mutation', async () => {
    const query = gql`
      mutation {
        withAuth
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "withAuth": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to resolve Mutation.withAuth],
        ],
      }
    `);
  });
});
