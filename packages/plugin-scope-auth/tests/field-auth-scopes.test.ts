import { gql } from 'apollo-server';
import { execute } from 'graphql';
import exampleSchema from './example/schema';
import User from './example/user';

describe('queries for field authScopes with', () => {
  it('simple field scope', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAdmin": "ok",
        },
      }
    `);
  });

  it('simple field scope (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAdmin],
        ],
      }
    `);
  });

  it('field scope with sync loader', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forSyncPermission": "ok",
        },
      }
    `);
  });

  it('field scope with sync loader (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forSyncPermission],
        ],
      }
    `);
  });

  it('field scope with async loader', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAsyncPermission": "ok",
        },
      }
    `);
  });

  it('field scope with async loader (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAsyncPermission],
        ],
      }
    `);
  });

  it('field with $any (sync)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAny": "ok",
        },
      }
    `);
  });

  it('field with $any (admin)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAny": "ok",
        },
      }
    `);
  });

  it('field with $any (async)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAny": "ok",
        },
      }
    `);
  });

  it('field with $any (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAny],
        ],
      }
    `);
  });

  it('field with $all', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAll": "ok",
        },
      }
    `);
  });

  it('field with $all (admin, unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAll],
        ],
      }
    `);
  });

  it('field with $all (async, unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAll],
        ],
      }
    `);
  });

  it('field with $all (sync, unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAll],
        ],
      }
    `);
  });

  it('field with empty $any', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.emptyAny],
        ],
      }
    `);
  });

  it('field with empty $all', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "emptyAll": "ok",
        },
      }
    `);
  });

  it('simple field scope fn', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAdminFn": "ok",
        },
      }
    `);
  });

  it('simple field scope fn (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAdminFn],
        ],
      }
    `);
  });

  it('simple field scope fn async', async () => {
    const query = gql`
      query {
        forAdminAsyncFn
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
          "forAdminAsyncFn": "ok",
        },
      }
    `);
  });

  it('simple field scope fn async (unauthorized)', async () => {
    const query = gql`
      query {
        forAdminAsyncFn
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
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAdminAsyncFn],
        ],
      }
    `);
  });

  it('field scope fn with sync loader', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forSyncPermissionFn": "ok",
        },
      }
    `);
  });

  it('field scope fn with sync loader (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forSyncPermissionFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forSyncPermissionFn],
        ],
      }
    `);
  });

  it('field scope fn with async loader', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAsyncPermissionFn": "ok",
        },
      }
    `);
  });

  it('field scope fn with async loader (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAsyncPermissionFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAsyncPermissionFn],
        ],
      }
    `);
  });

  it('field fn with $any (sync)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAnyFn": "ok",
        },
      }
    `);
  });

  it('field fn with $any (admin)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAnyFn": "ok",
        },
      }
    `);
  });

  it('field fn with $any (async)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAnyFn": "ok",
        },
      }
    `);
  });

  it('field fn with $any (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAnyFn],
        ],
      }
    `);
  });

  it('field fn with $all', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAllFn": "ok",
        },
      }
    `);
  });

  it('field fn with $all (admin, unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAllFn],
        ],
      }
    `);
  });

  it('field fn with $all (async, unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAllFn],
        ],
      }
    `);
  });

  it('field fn with $all (sync, unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forAllFn],
        ],
      }
    `);
  });

  it('field fn with empty $any', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.emptyAnyFn],
        ],
      }
    `);
  });

  it('field fn with empty $all', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "emptyAllFn": "ok",
        },
      }
    `);
  });

  it('field fn return boolean', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forBooleanFn": "ok",
        },
      }
    `);
  });

  it('field fn return boolean (unauthorized)', async () => {
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Not authorized to resolve Query.forBooleanFn],
        ],
      }
    `);
  });
});
