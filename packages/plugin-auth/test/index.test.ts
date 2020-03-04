import { printSchema, execute } from 'graphql';
import gql from 'graphql-tag';
import authSchema from './examples/auth/schema';
import { createContext } from './examples/auth/data';

describe('auth example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(authSchema)).toMatchSnapshot();
  });

  describe('query user', () => {
    test('without a user', async () => {
      const query = gql`
        query {
          user(id: 1) {
            id
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on Query.user failed. Missing the following permission: readUser',
        }),
      ]);
    });

    test('with an admin', async () => {
      const query = gql`
        query {
          user(id: 1) {
            firstName
            lastName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result).toEqual({
        data: {
          user: {
            firstName: 'Michael',
            lastName: 'Hayes',
            email: 'michael.hayes@example.com',
          },
        },
      });
    });

    test('permission check defined on parent fails', async () => {
      const query = gql`
        query {
          user(id: 2) {
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.email failed. Missing the following permission: readEmail',
        }),
      ]);
    });

    test('granted auth check passes', async () => {
      const query = gql`
        query {
          user(id: 2) {
            id
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result.errors).toBeUndefined();

      expect(result.data).toEqual({
        user: {
          id: '2',
        },
      });
    });

    test('granted permission check fails', async () => {
      const query = gql`
        query {
          user(id: 2) {
            id
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.id failed. Missing the following permission: readUserId',
        }),
      ]);
    });

    test('permission check defined on field fails', async () => {
      const query = gql`
        query {
          user(id: 1) {
            firstName
            lastName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message: 'Permission check on User.lastName failed.',
        }),
      ]);
    });
  });

  describe('query users', () => {
    test('without a user', async () => {
      const query = gql`
        query {
          users {
            id
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on Query.users failed. Missing the following permission: readUser',
        }),
      ]);
    });

    test('checks pass', async () => {
      const query = gql`
        query {
          users {
            firstName
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result.errors).toBeUndefined();

      expect(result.data).toEqual({
        users: [
          {
            firstName: 'Michael',
          },
          {
            firstName: 'Darth',
          },
        ],
      });
    });

    test('auth check defined on parent fails', async () => {
      const query = gql`
        query {
          users {
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.email failed. Missing the following permission: readEmail',
        }),
      ]);

      expect(result.data).toEqual({
        users: [
          {
            firstName: 'Michael',
            email: 'michael.hayes@example.com',
          },
          null,
        ],
      });
    });

    test('granted auth check fails', async () => {
      const query = gql`
        query {
          users {
            id
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.id failed. Missing the following permission: readUserId',
        }),
        expect.objectContaining({
          message:
            'Permission check on User.id failed. Missing the following permission: readUserId',
        }),
      ]);

      expect(result.data).toEqual({
        users: [null, null],
      });
    });

    test('permission check defined on field fails', async () => {
      const query = gql`
        query {
          users {
            firstName
            lastName
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message: 'Permission check on User.lastName failed.',
        }),
      ]);

      expect(result.data).toEqual({
        users: [
          null,
          {
            firstName: 'Darth',
            lastName: 'Vader',
          },
        ],
      });
    });
  });

  describe('mutations', () => {
    test('createUser', async () => {
      const query = gql`
        mutation {
          createUser(firstName: "Foo", lastName: "Bar") {
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result.errors).toBeUndefined();

      expect(result.data).toEqual({
        createUser: {
          email: 'foo.bar@example.com',
        },
      });
    });
  });

  describe('shapes (Unions interfaces and postResolveCheck)', () => {
    test('query all the shapes', async () => {
      const query = gql`
        query {
          square {
            name
            size
          }
          shapes {
            name
            ... on Square {
              size
            }
            ... on Triangle {
              edges
            }
            ... on Circle {
              area
            }
          }
          polygons {
            ... on Square {
              name
              size
            }
            ... on Triangle {
              name
              edges
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          square: {
            name: null,
            size: 16,
          },
          shapes: [
            null,
            {
              name: 'square',
              size: 16,
            },
            {
              name: 'triangle',
              edges: null,
            },
          ],
          polygons: [
            {
              name: 'square',
              size: 16,
            },
            {
              name: 'triangle',
              edges: null,
            },
          ],
        },
        errors: [
          expect.objectContaining({
            message:
              'Permission check on Shape.name failed. Missing the following permission: readName',
            path: ['square', 'name'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Triangle.edges failed. Missing the following permission: readTriangle',
            path: ['shapes', 2, 'edges'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Triangle.edges failed. Missing the following permission: readTriangle',
            path: ['polygons', 1, 'edges'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Circle.area failed. Missing the following permission: readCircle',
            path: ['shapes', 0, 'area'],
          }),
        ],
      });
    });
  });
});
