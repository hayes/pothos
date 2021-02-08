import { gql } from 'apollo-server';
import { execute } from 'graphql';

import exampleSchema from './example/schema';
import User from './example/user';

describe('queries for type authScopes with', () => {
  test('simple type scope', async () => {
    const query = gql`
      query {
        ObjForAdmin {
          field
        }
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

  test('simple type scope (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAdmin {
          field
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

    expect(result).toMatchSnapshot();
  });

  test('type scope with sync loader', async () => {
    const query = gql`
      query {
        ObjForSyncPerm {
          field
        }
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

  test('type scope with sync loader (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForSyncPerm {
          field
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

    expect(result).toMatchSnapshot();
  });

  test('type scope with async loader', async () => {
    const query = gql`
      query {
        ObjForAsyncPerm {
          field
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

    expect(result).toMatchSnapshot();
  });

  test('type scope with async loader (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAsyncPerm {
          field
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

    expect(result).toMatchSnapshot();
  });

  test('type with $any (sync)', async () => {
    const query = gql`
      query {
        ObjForAny {
          field
        }
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

  test('type with $any (admin)', async () => {
    const query = gql`
      query {
        ObjForAny {
          field
        }
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

  test('type with $any (async)', async () => {
    const query = gql`
      query {
        ObjForAny {
          field
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

    expect(result).toMatchSnapshot();
  });

  test('type with $any (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAny {
          field
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

    expect(result).toMatchSnapshot();
  });

  test('type with $all', async () => {
    const query = gql`
      query {
        ObjForAll {
          field
        }
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

  test('type with $all (admin, unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAll {
          field
        }
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

  test('type with $all (async, unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAll {
          field
        }
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

  test('type with $all (sync, unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAll {
          field
        }
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

  test('type with empty $any', async () => {
    const query = gql`
      query {
        ObjEmptyAny {
          field
        }
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

  test('type with empty $all', async () => {
    const query = gql`
      query {
        ObjEmptyAll {
          field
        }
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
