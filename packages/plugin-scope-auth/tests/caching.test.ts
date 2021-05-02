import { gql } from 'apollo-server';
import { execute } from 'graphql';
import schema from './example/schema';
import User from './example/user';

class Counter {
  counts = new Map<string, number>();

  count = (name: string) => {
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
  };
}

describe('caching', () => {
  describe('loaders', () => {
    it('sync loaders', async () => {
      const query = gql`
        query {
          a1: forSyncPermissionFn(permission: "a")
          a2: forSyncPermissionFn(permission: "a")
          obj1: ObjForSyncPermFn(permission: "a") {
            a1: field
            a2: field
          }
          b1: forSyncPermissionFn(permission: "b")
          b2: forSyncPermissionFn(permission: "b")
          obj2: ObjForSyncPermFn(permission: "b") {
            b1: field
            b2: field
          }
        }
      `;

      const counter = new Counter();

      const result = await execute({
        schema,
        document: query,
        contextValue: {
          count: counter.count,
          User: new User({
            'x-user-id': '1',
            'x-permissions': 'a',
          }),
        },
      });

      expect(counter.counts.get('syncPermission')).toEqual(2);

      expect(result).toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "a1": "ok",
            "a2": "ok",
            "b1": null,
            "b2": null,
            "obj1": Object {
              "a1": "ok",
              "a2": "ok",
            },
            "obj2": Object {
              "b1": null,
              "b2": null,
            },
          },
          "errors": Array [
            [GraphQLError: Not authorized to resolve Query.forSyncPermissionFn],
            [GraphQLError: Not authorized to resolve Query.forSyncPermissionFn],
            [GraphQLError: Not authorized to read fields for ObjForSyncPermFn],
            [GraphQLError: Not authorized to read fields for ObjForSyncPermFn],
          ],
        }
      `);
    });

    it('async loaders', async () => {
      const query = gql`
        query {
          a1: forAsyncPermissionFn(permission: "a")
          a2: forAsyncPermissionFn(permission: "a")
          obj1: ObjForAsyncPermFn(permission: "a") {
            a1: field
            a2: field
          }
          b1: forAsyncPermissionFn(permission: "b")
          b2: forAsyncPermissionFn(permission: "b")
          obj2: ObjForAsyncPermFn(permission: "b") {
            b1: field
            b2: field
          }
        }
      `;

      const counter = new Counter();

      const result = await execute({
        schema,
        document: query,
        contextValue: {
          count: counter.count,
          User: new User({
            'x-user-id': '1',
            'x-permissions': 'a',
          }),
        },
      });

      expect(counter.counts.get('asyncPermission')).toEqual(2);

      expect(result).toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "a1": "ok",
            "a2": "ok",
            "b1": null,
            "b2": null,
            "obj1": Object {
              "a1": "ok",
              "a2": "ok",
            },
            "obj2": null,
          },
          "errors": Array [
            [GraphQLError: Not authorized to resolve Query.forAsyncPermissionFn],
            [GraphQLError: Not authorized to resolve Query.forAsyncPermissionFn],
            [GraphQLError: Not authorized to read fields for ObjForAsyncPermFn],
          ],
        }
      `);
    });
  });
  describe('types', () => {
    it('sync authScopes', async () => {
      const query = gql`
        query {
          obj1: ObjForSyncPermFn(permission: "a") {
            a1: field
            a2: field
          }
          obj2: ObjForSyncPermFn(permission: "b") {
            a1: field
            a2: field
          }
        }
      `;

      const counter = new Counter();

      const result = await execute({
        schema,
        document: query,
        contextValue: {
          count: counter.count,
          User: new User({
            'x-user-id': '1',
            'x-permissions': 'a',
          }),
        },
      });

      expect(counter.counts.get('ObjForSyncPermFn')).toEqual(2);

      expect(result).toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "obj1": Object {
              "a1": "ok",
              "a2": "ok",
            },
            "obj2": Object {
              "a1": null,
              "a2": null,
            },
          },
          "errors": Array [
            [GraphQLError: Not authorized to read fields for ObjForSyncPermFn],
            [GraphQLError: Not authorized to read fields for ObjForSyncPermFn],
          ],
        }
      `);
    });

    it('async authScopes', async () => {
      const query = gql`
        query {
          obj1: ObjForAdminAsyncFn {
            a1: field
            a2: field
          }
          obj2: ObjForAdminAsyncFn {
            a1: field
            a2: field
          }
        }
      `;

      const counter = new Counter();

      const result = await execute({
        schema,
        document: query,
        contextValue: {
          count: counter.count,
          User: new User({
            'x-user-id': '1',
            'x-roles': 'admin',
          }),
        },
      });

      expect(counter.counts.get('ObjForAdminAsyncFn')).toEqual(2);

      expect(result).toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "obj1": Object {
              "a1": "ok",
              "a2": "ok",
            },
            "obj2": Object {
              "a1": "ok",
              "a2": "ok",
            },
          },
        }
      `);
    });
  });
});
