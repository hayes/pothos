import { gql } from 'apollo-server';
import { execute } from 'graphql';

import exampleSchema from './example/schema';
import User from './example/user';

describe('queries for field authScopes with', () => {
  test('simple field scope', async () => {
    const query = gql`
      query {
        forAdmin
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('simple field scope (unauthorized)', async () => {
    const query = gql`
      query {
        forAdmin
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

    expect(result).toMatchSnapshot();
  });

  test('field scope with sync loader', async () => {
    const query = gql`
      query {
        forSyncPermission
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field scope with sync loader (unauthorized)', async () => {
    const query = gql`
      query {
        forSyncPermission
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

    expect(result).toMatchSnapshot();
  });

  test('field scope with async loader', async () => {
    const query = gql`
      query {
        forAsyncPermission
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

    expect(result).toMatchSnapshot();
  });

  test('field scope with async loader (unauthorized)', async () => {
    const query = gql`
      query {
        forAsyncPermission
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

    expect(result).toMatchSnapshot();
  });

  test('field with $any (sync)', async () => {
    const query = gql`
      query {
        forAny
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field with $any (admin)', async () => {
    const query = gql`
      query {
        forAny
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field with $any (async)', async () => {
    const query = gql`
      query {
        forAny
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

    expect(result).toMatchSnapshot();
  });

  test('field with $any (unauthorized)', async () => {
    const query = gql`
      query {
        forAny
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

    expect(result).toMatchSnapshot();
  });

  test('field with $all', async () => {
    const query = gql`
      query {
        forAll
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field with $all (admin, unauthorized)', async () => {
    const query = gql`
      query {
        forAll
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field with $all (async, unauthorized)', async () => {
    const query = gql`
      query {
        forAll
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field with $all (sync, unauthorized)', async () => {
    const query = gql`
      query {
        forAll
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field with empty $any', async () => {
    const query = gql`
      query {
        emptyAny
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({}),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field with empty $all', async () => {
    const query = gql`
      query {
        emptyAll
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({}),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('simple field scope fn', async () => {
    const query = gql`
      query {
        forAdminFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('simple field scope fn (unauthorized)', async () => {
    const query = gql`
      query {
        forAdminFn
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

    expect(result).toMatchSnapshot();
  });

  test('field scope fn with sync loader', async () => {
    const query = gql`
      query {
        forSyncPermissionFn(permission: "x")
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'x',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field scope fn with sync loader (unauthorized)', async () => {
    const query = gql`
      query {
        forSyncPermissionFn(permission: "x")
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        user: new User({
          'x-user-id': '1',
          'x-permissions': 'y',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field scope fn with async loader', async () => {
    const query = gql`
      query {
        forAsyncPermissionFn(permission: "x")
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'x',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field scope fn with async loader (unauthorized)', async () => {
    const query = gql`
      query {
        forAsyncPermissionFn(permission: "x")
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        user: new User({
          'x-user-id': '1',
          'x-permissions': 'y',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with $any (sync)', async () => {
    const query = gql`
      query {
        forAnyFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with $any (admin)', async () => {
    const query = gql`
      query {
        forAnyFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with $any (async)', async () => {
    const query = gql`
      query {
        forAnyFn
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

    expect(result).toMatchSnapshot();
  });

  test('field fn with $any (unauthorized)', async () => {
    const query = gql`
      query {
        forAnyFn
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

    expect(result).toMatchSnapshot();
  });

  test('field fn with $all', async () => {
    const query = gql`
      query {
        forAllFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with $all (admin, unauthorized)', async () => {
    const query = gql`
      query {
        forAllFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with $all (async, unauthorized)', async () => {
    const query = gql`
      query {
        forAllFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with $all (sync, unauthorized)', async () => {
    const query = gql`
      query {
        forAllFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with empty $any', async () => {
    const query = gql`
      query {
        emptyAnyFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({}),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn with empty $all', async () => {
    const query = gql`
      query {
        emptyAllFn
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({}),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn return boolean', async () => {
    const query = gql`
      query {
        forBooleanFn(result: true)
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({}),
      },
    });

    expect(result).toMatchSnapshot();
  });

  test('field fn return boolean (unauthorized)', async () => {
    const query = gql`
      query {
        forBooleanFn(result: false)
      }
    `;

    const result = await execute({
      schema: exampleSchema,
      document: query,
      contextValue: {
        User: new User({}),
      },
    });

    expect(result).toMatchSnapshot();
  });
});
