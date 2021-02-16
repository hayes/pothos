import { gql } from 'apollo-server';
import { execute } from 'graphql';
import exampleSchema from './example/schema';
import User from './example/user';

describe('interfaces', () => {
  test('object with simple interface authScope check', async () => {
    const query = gql`
      query {
        ObjAdminIface {
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
          "ObjAdminIface": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('object with simple interface authScope check (unauthorized)', async () => {
    const query = gql`
      query {
        ObjAdminIface {
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
          "ObjAdminIface": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for IfaceForAdmin],
        ],
      }
    `);
  });

  test('object with interface authScope fn', async () => {
    const query = gql`
      query {
        ObjBooleanIface(result: true) {
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
          "ObjBooleanIface": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('object with interface authScope fn (unauthorized)', async () => {
    const query = gql`
      query {
        ObjBooleanIface(result: false) {
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
          "ObjBooleanIface": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for IfaceBooleanFn],
        ],
      }
    `);
  });

  test('interface with simple authScope check', async () => {
    const query = gql`
      query {
        IfaceForAdmin {
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
          "IfaceForAdmin": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('interface with simple authScope check (unauthorized)', async () => {
    const query = gql`
      query {
        IfaceForAdmin {
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
          "IfaceForAdmin": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for IfaceForAdmin],
        ],
      }
    `);
  });

  test('interface with authScope fn', async () => {
    const query = gql`
      query {
        IfaceBooleanFn(result: true) {
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
          "IfaceBooleanFn": Object {
            "field": "ok",
          },
        },
      }
    `);
  });

  test('interface with authScope fn (unauthorized)', async () => {
    const query = gql`
      query {
        IfaceBooleanFn(result: false) {
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
          "IfaceBooleanFn": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for IfaceBooleanFn],
        ],
      }
    `);
  });
});
