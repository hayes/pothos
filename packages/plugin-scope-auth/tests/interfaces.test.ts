import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import exampleSchema from './example/schema';
import User from './example/user';

describe('interfaces', () => {
  it('object with simple interface authScope check', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjAdminIface": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('object with simple interface authScope check (unauthorized)', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjAdminIface": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for IfaceForAdmin],
        ],
      }
    `);
  });

  it('object with interface authScope fn', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjBooleanIface": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('object with interface authScope fn (unauthorized)', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjBooleanIface": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for IfaceBooleanFn],
        ],
      }
    `);
  });

  it('interface with simple authScope check', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "IfaceForAdmin": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('interface with simple authScope check (unauthorized)', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "IfaceForAdmin": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for IfaceForAdmin],
        ],
      }
    `);
  });

  it('interface with authScope fn', async () => {
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "IfaceBooleanFn": {
            "field": "ok",
          },
        },
      }
    `);
  });

  it('interface with authScope fn (unauthorized)', async () => {
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
        user: new User({}),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "IfaceBooleanFn": {
            "field": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for IfaceBooleanFn],
        ],
      }
    `);
  });
});
