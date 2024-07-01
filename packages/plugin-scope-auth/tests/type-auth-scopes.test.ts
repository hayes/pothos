import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import exampleSchema from './example/schema';
import User from './example/user';

describe('queries for type authScopes with', () => {
  it('simple type scope', async () => {
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
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAdmin": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('simple type scope (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForAdmin": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAdmin],
        ],
      }
    `);
  });

  it('type scope with sync loader', async () => {
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
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForSyncPerm": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type scope with sync loader (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForSyncPerm": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForSyncPerm],
        ],
      }
    `);
  });

  it('type scope with async loader', async () => {
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
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAsyncPerm": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type scope with async loader (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForAsyncPerm": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAsyncPerm],
        ],
      }
    `);
  });

  it('type with $any (sync)', async () => {
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
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAny": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type with $any (admin)', async () => {
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
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAny": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type with $any (async)', async () => {
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
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAny": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type with $any (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForAny": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAny],
        ],
      }
    `);
  });

  it('type with $all', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAll": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type with $all (admin, unauthorized)', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAll": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAll],
        ],
      }
    `);
  });

  it('type with $all (async, unauthorized)', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAll": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAll],
        ],
      }
    `);
  });

  it('type with $all (sync, unauthorized)', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAll": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAll],
        ],
      }
    `);
  });

  it('type with empty $any', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjEmptyAny": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjEmptyAny],
        ],
      }
    `);
  });

  it('type with empty $all', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjEmptyAll": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('simple type scope fn', async () => {
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
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAdminFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('simple type scope fn async', async () => {
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
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAdminAsyncFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('simple type scope fn (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForAdminFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAdminFn],
        ],
      }
    `);
  });

  it('simple type scope async fn (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForAdminAsyncFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAdminAsyncFn],
        ],
      }
    `);
  });

  it('type scope fn with sync loader', async () => {
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
          'x-permissions': 'x',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForSyncPermFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type scope fn with sync loader (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForSyncPermFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForSyncPermFn],
        ],
      }
    `);
  });

  it('type scope fn with async loader', async () => {
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
          'x-permissions': 'x',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAsyncPermFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type scope fn with async loader (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForAsyncPermFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAsyncPermFn],
        ],
      }
    `);
  });

  it('type fn with $any (sync)', async () => {
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
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAnyFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type fn with $any (admin)', async () => {
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
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAnyFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type fn with $any (async)', async () => {
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
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAnyFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type fn with $any (unauthorized)', async () => {
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
      {
        "data": {
          "ObjForAnyFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAnyFn],
        ],
      }
    `);
  });

  it('type fn with $all', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAllFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type fn with $all (admin, unauthorized)', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-permissions': 'a,b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAllFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAllFn],
        ],
      }
    `);
  });

  it('type fn with $all (async, unauthorized)', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'a',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAllFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAllFn],
        ],
      }
    `);
  });

  it('type fn with $all (sync, unauthorized)', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
          'x-permissions': 'b',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjForAllFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjForAllFn],
        ],
      }
    `);
  });

  it('type fn with empty $any', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjEmptyAnyFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjEmptyAnyFn],
        ],
      }
    `);
  });

  it('type fn with empty $all', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjEmptyAllFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('type fn with boolean return', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjBooleanFn": {
            "field": "ok",
          },
        },
      }
    `);
  });
  it('type fn with boolean return (unauthorized)', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjBooleanFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for ObjBooleanFn],
        ],
      }
    `);
  });
});
