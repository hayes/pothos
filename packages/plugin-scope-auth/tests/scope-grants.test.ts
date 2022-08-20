import { execute } from 'graphql';
import { gql } from 'graphql-tag';
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjExpectsGrants": {
            "field": "ok",
          },
          "ObjExpectsGrantsAsyncFn": {
            "field": "ok",
          },
          "ObjExpectsGrantsAsyncFnMissing": null,
          "ObjExpectsGrantsFn": {
            "field": "ok",
          },
          "ObjExpectsGrantsFnMissing": null,
          "ObjExpectsGrantsMissing": null,
        },
        "errors": [
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjFieldExpectsGrants": {
            "field": "ok",
          },
          "ObjFieldExpectsGrantsAsyncFn": {
            "field": "ok",
          },
          "ObjFieldExpectsGrantsAsyncFnMissing": null,
          "ObjFieldExpectsGrantsFn": {
            "field": "ok",
          },
          "ObjFieldExpectsGrantsFnMissing": null,
          "ObjFieldExpectsGrantsMissing": null,
        },
        "errors": [
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjExpectsGrantsList": [
            {
              "field": "ok",
            },
            {
              "field": "ok",
            },
          ],
          "ObjExpectsGrantsListAsyncFn": [
            {
              "field": "ok",
            },
            {
              "field": "ok",
            },
          ],
          "ObjExpectsGrantsListAsyncFnMissing": [
            null,
            null,
          ],
          "ObjExpectsGrantsListFn": [
            {
              "field": "ok",
            },
            {
              "field": "ok",
            },
          ],
          "ObjExpectsGrantsListFnMissing": [
            null,
            null,
          ],
          "ObjExpectsGrantsListMissing": [
            null,
            null,
          ],
        },
        "errors": [
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
        user: new User({
          'x-user-id': '1',
          'x-roles': 'admin',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjFieldExpectsGrantsList": [
            {
              "field": "ok",
            },
            {
              "field": "ok",
            },
          ],
          "ObjFieldExpectsGrantsListAsyncFn": [
            {
              "field": "ok",
            },
            {
              "field": "ok",
            },
          ],
          "ObjFieldExpectsGrantsListAsyncFnMissing": [
            null,
            null,
          ],
          "ObjFieldExpectsGrantsListFn": [
            {
              "field": "ok",
            },
            {
              "field": "ok",
            },
          ],
          "ObjFieldExpectsGrantsListFnMissing": [
            null,
            null,
          ],
          "ObjFieldExpectsGrantsListMissing": [
            null,
            null,
          ],
        },
        "errors": [
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
