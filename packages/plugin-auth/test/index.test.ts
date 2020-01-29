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
          message: 'Failed 1 auth check on Query.user (readUser)',
        }),
      ]);
    });

    test('with an admin', async () => {
      const query = gql`
        query {
          user(id: 1) {
            id
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

      expect(result.data).toEqual({
        user: {
          id: '1',
          firstName: 'Michael',
          lastName: 'Hayes',
          email: 'michael.hayes@example.com',
        },
      });
    });

    test('auth check defined on parent fails', async () => {
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
          message: 'Failed 1 auth check on User.email (readEmail)',
        }),
      ]);
    });

    test('granted auth check fails', async () => {
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
          message: 'Failed 1 auth check on User.id (readUserId)',
        }),
      ]);
    });

    test('auth check defined on field fails', async () => {
      const query = gql`
        query {
          user(id: 1) {
            id
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
          message: 'Failed 1 auth check on User.lastName ([anonymous])',
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
          message: 'Failed 1 auth check on Query.users (readUser)',
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
          message: 'Failed 1 auth check on User.email (readEmail)',
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
          message: 'Failed 1 auth check on User.id (readUserId)',
        }),
      ]);

      expect(result.data).toEqual({
        users: [
          {
            id: '1',
          },
          null,
        ],
      });
    });

    test('auth check defined on field fails', async () => {
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
          message: 'Failed 1 auth check on User.lastName ([anonymous])',
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
});
