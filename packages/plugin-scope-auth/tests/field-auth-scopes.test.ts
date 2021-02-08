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
});
