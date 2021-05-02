import { gql } from 'apollo-server';
import { execute } from 'graphql';
import exampleSchema from './example/schema';
import User from './example/user';

describe('query', () => {
  it('object with expected grants', async () => {
    const query = gql`
      query {
        ObjExpectsGrants {
          field
        }
        ObjExpectsGrantsFn(result: true) {
          field
        }
        ObjExpectsGrantsAsyncFn(result: true) {
          field
        }
        ObjExpectsGrantsMissing {
          field
        }
        ObjExpectsGrantsFnMissing: ObjExpectsGrantsFn(result: false) {
          field
        }
        ObjExpectsGrantsAsyncFnMissing: ObjExpectsGrantsAsyncFn(result: false) {
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
          "ObjExpectsGrants": Object {
            "field": "ok",
          },
          "ObjExpectsGrantsAsyncFn": Object {
            "field": "ok",
          },
          "ObjExpectsGrantsAsyncFnMissing": null,
          "ObjExpectsGrantsFn": Object {
            "field": "ok",
          },
          "ObjExpectsGrantsFnMissing": null,
          "ObjExpectsGrantsMissing": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
        ],
      }
    `);
  });

  it('object with field that expected grants', async () => {
    const query = gql`
      query {
        ObjFieldExpectsGrants {
          field
        }
        ObjFieldExpectsGrantsFn(result: true) {
          field
        }
        ObjFieldExpectsGrantsAsyncFn(result: true) {
          field
        }
        ObjFieldExpectsGrantsMissing {
          field
        }
        ObjFieldExpectsGrantsFnMissing: ObjFieldExpectsGrantsFn(result: false) {
          field
        }
        ObjFieldExpectsGrantsAsyncFnMissing: ObjFieldExpectsGrantsAsyncFn(result: false) {
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
          "ObjFieldExpectsGrants": Object {
            "field": "ok",
          },
          "ObjFieldExpectsGrantsAsyncFn": Object {
            "field": "ok",
          },
          "ObjFieldExpectsGrantsAsyncFnMissing": null,
          "ObjFieldExpectsGrantsFn": Object {
            "field": "ok",
          },
          "ObjFieldExpectsGrantsFnMissing": null,
          "ObjFieldExpectsGrantsMissing": null,
        },
        "errors": Array [
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
        ],
      }
    `);
  });

  it('object list that expected grants', async () => {
    const query = gql`
      query {
        ObjExpectsGrantsList {
          field
        }
        ObjExpectsGrantsListFn(result: true) {
          field
        }
        ObjExpectsGrantsListAsyncFn(result: true) {
          field
        }
        ObjExpectsGrantsListMissing {
          field
        }
        ObjExpectsGrantsListFnMissing: ObjExpectsGrantsListFn(result: false) {
          field
        }
        ObjExpectsGrantsListAsyncFnMissing: ObjExpectsGrantsListAsyncFn(result: false) {
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
          "ObjExpectsGrantsList": Array [
            Object {
              "field": "ok",
            },
            Object {
              "field": "ok",
            },
          ],
          "ObjExpectsGrantsListAsyncFn": Array [
            Object {
              "field": "ok",
            },
            Object {
              "field": "ok",
            },
          ],
          "ObjExpectsGrantsListAsyncFnMissing": Array [
            null,
            null,
          ],
          "ObjExpectsGrantsListFn": Array [
            Object {
              "field": "ok",
            },
            Object {
              "field": "ok",
            },
          ],
          "ObjExpectsGrantsListFnMissing": Array [
            null,
            null,
          ],
          "ObjExpectsGrantsListMissing": Array [
            null,
            null,
          ],
        },
        "errors": Array [
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
          [GraphQLError: Not authorized to read fields for ObjExpectsGrants],
        ],
      }
    `);
  });

  it('object list with field that expected grants', async () => {
    const query = gql`
      query {
        ObjFieldExpectsGrantsList {
          field
        }
        ObjFieldExpectsGrantsListFn(result: true) {
          field
        }
        ObjFieldExpectsGrantsListAsyncFn(result: true) {
          field
        }
        ObjFieldExpectsGrantsListMissing {
          field
        }
        ObjFieldExpectsGrantsListFnMissing: ObjFieldExpectsGrantsListFn(result: false) {
          field
        }
        ObjFieldExpectsGrantsListAsyncFnMissing: ObjFieldExpectsGrantsListAsyncFn(result: false) {
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
          "ObjFieldExpectsGrantsList": Array [
            Object {
              "field": "ok",
            },
            Object {
              "field": "ok",
            },
          ],
          "ObjFieldExpectsGrantsListAsyncFn": Array [
            Object {
              "field": "ok",
            },
            Object {
              "field": "ok",
            },
          ],
          "ObjFieldExpectsGrantsListAsyncFnMissing": Array [
            null,
            null,
          ],
          "ObjFieldExpectsGrantsListFn": Array [
            Object {
              "field": "ok",
            },
            Object {
              "field": "ok",
            },
          ],
          "ObjFieldExpectsGrantsListFnMissing": Array [
            null,
            null,
          ],
          "ObjFieldExpectsGrantsListMissing": Array [
            null,
            null,
          ],
        },
        "errors": Array [
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
          [GraphQLError: Not authorized to resolve ObjFieldExpectsGrants.field],
        ],
      }
    `);
  });
});
