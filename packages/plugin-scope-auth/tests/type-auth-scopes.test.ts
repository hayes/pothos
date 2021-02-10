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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAdmin": Object {
            "field": "ok",
          },
        },
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAdmin": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAdmin],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForSyncPerm": Object {
            "field": "ok",
          },
        },
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForSyncPerm": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForSyncPerm],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAsyncPerm": Object {
            "field": "ok",
          },
        },
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAsyncPerm": Object {
            "field": null,
          },
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAsyncPerm],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAny": Object {
            "field": "ok",
          },
        },
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAny": Object {
            "field": "ok",
          },
        },
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAny": Object {
            "field": "ok",
          },
        },
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAny": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAny],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAll": Object {
            "field": "ok",
          },
        },
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAll": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAll],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAll": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAll],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAll": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAll],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjEmptyAny": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjEmptyAny],
        ],
      }
    `);
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjEmptyAll": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('simple type scope fn', async () => {
    const query = gql`
      query {
        ObjForAdminFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAdminFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('simple type scope fn async', async () => {
    const query = gql`
      query {
        ObjForAdminAsyncFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAdminAsyncFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('simple type scope fn (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAdminFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAdminFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAdminFn],
        ],
      }
    `);
  });

  test('simple type scope async fn (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAdminAsyncFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAdminAsyncFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAdminAsyncFn],
        ],
      }
    `);
  });

  test('type scope fn with sync loader', async () => {
    const query = gql`
      query {
        ObjForSyncPermFn(permission: "x") {
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
          'x-permissions': 'x',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForSyncPermFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('type scope fn with sync loader (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForSyncPermFn(permission: "x") {
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
          'x-permissions': 'y',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForSyncPermFn": Object {
            "field": null,
          },
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForSyncPermFn],
        ],
      }
    `);
  });

  test('type scope fn with async loader', async () => {
    const query = gql`
      query {
        ObjForAsyncPermFn(permission: "x") {
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
          'x-permissions': 'x',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAsyncPermFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('type scope fn with async loader (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAsyncPermFn(permission: "x") {
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
          'x-permissions': 'y',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAsyncPermFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAsyncPermFn],
        ],
      }
    `);
  });

  test('type fn with $any (sync)', async () => {
    const query = gql`
      query {
        ObjForAnyFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAnyFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('type fn with $any (admin)', async () => {
    const query = gql`
      query {
        ObjForAnyFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAnyFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('type fn with $any (async)', async () => {
    const query = gql`
      query {
        ObjForAnyFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAnyFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('type fn with $any (unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAnyFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAnyFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAnyFn],
        ],
      }
    `);
  });

  test('type fn with $all', async () => {
    const query = gql`
      query {
        ObjForAllFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAllFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('type fn with $all (admin, unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAllFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAllFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAllFn],
        ],
      }
    `);
  });

  test('type fn with $all (async, unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAllFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAllFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAllFn],
        ],
      }
    `);
  });

  test('type fn with $all (sync, unauthorized)', async () => {
    const query = gql`
      query {
        ObjForAllFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjForAllFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjForAllFn],
        ],
      }
    `);
  });

  test('type fn with empty $any', async () => {
    const query = gql`
      query {
        ObjEmptyAnyFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjEmptyAnyFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjEmptyAnyFn],
        ],
      }
    `);
  });

  test('type fn with empty $all', async () => {
    const query = gql`
      query {
        ObjEmptyAllFn {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjEmptyAllFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('type fn with boolean return', async () => {
    const query = gql`
      query {
        ObjBooleanFn(result: true) {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjBooleanFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });
  test('type fn with boolean return (unauthorized)', async () => {
    const query = gql`
      query {
        ObjBooleanFn(result: false) {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "ObjBooleanFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjBooleanFn],
        ],
      }
    `);
  });
});
