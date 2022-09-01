import { execute as rawExecute } from 'graphql';
import { gql } from 'graphql-tag';
import { wrapExecuteFn } from '@graphql-authz/core';
import { rules } from './example/builder';
import { users } from './example/data';
import schema from './example/schema';

const execute = wrapExecuteFn(rawExecute, { rules });

describe('authz', () => {
  it('unauthenticated', async () => {
    const query = gql`
      query {
        users {
          id
        }
      }
    `;

    await expect(
      execute({
        schema,
        document: query,
        contextValue: {},
      }),
    ).rejects.toMatchObject({
      message: 'User is not authenticated',
    });
  });

  it('authenticated', async () => {
    const query = gql`
      query {
        users {
          id
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {
        user: users[0],
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "users": [
            {
              "id": "1",
            },
            {
              "id": "2",
            },
          ],
        },
      }
    `);
  });

  it('normal user, admin query', async () => {
    const query = gql`
      query {
        users {
          id
          email
        }
      }
    `;

    await expect(
      execute({
        schema,
        document: query,
        contextValue: {
          user: users[0],
        },
      }),
    ).rejects.toMatchObject({
      message: 'User is not admin',
    });
  });

  it('amin user, admin query', async () => {
    const query = gql`
      query {
        users {
          id
          email
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {
        user: users[1],
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "users": [
            {
              "email": "user01@gmail.com",
              "id": "1",
            },
            {
              "email": "user02@gmail.com",
              "id": "2",
            },
          ],
        },
      }
    `);
  });

  it('auth rule on type (unauthorized)', async () => {
    const query = gql`
      query {
        posts {
          id
        }
      }
    `;
    await expect(
      execute({
        schema,
        document: query,
        contextValue: {
          user: users[1],
        },
      }),
    ).rejects.toMatchObject({
      message: 'Access denied',
    });
  });

  it('auth rule on type (authorized)', async () => {
    const query = gql`
      query {
        posts {
          id
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {
        user: users[0],
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": [
            {
              "id": "1",
            },
            {
              "id": "2",
            },
          ],
        },
      }
    `);
  });
});
