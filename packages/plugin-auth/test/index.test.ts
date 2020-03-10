import { printSchema, execute } from 'graphql';
import gql from 'graphql-tag';
import authSchema from './examples/auth/schema';
import { createContext } from './examples/auth/data';

describe('auth example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(authSchema)).toMatchSnapshot();
  });

  describe('query user', () => {
    test('without a user', async () => {
      const query = gql`
        query {
          user(id: 1) {
            id
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on Query.user failed. Missing the following permission: readUser',
        }),
      ]);
    });

    test('with an admin', async () => {
      const query = gql`
        query {
          user(id: 1) {
            firstName
            lastName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result).toEqual({
        data: {
          user: {
            firstName: 'Michael',
            lastName: 'Hayes',
            email: 'michael.hayes@example.com',
          },
        },
      });
    });

    test('permission check defined on parent fails', async () => {
      const query = gql`
        query {
          user(id: 2) {
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.email failed. Missing the following permission: readEmail',
        }),
      ]);
    });

    test('granted auth check passes', async () => {
      const query = gql`
        query {
          user(id: 2) {
            id
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result.errors).toBeUndefined();

      expect(result.data).toEqual({
        user: {
          id: '2',
        },
      });
    });

    test('granted permission check fails', async () => {
      const query = gql`
        query {
          user(id: 2) {
            id
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.id failed. Missing the following permission: readUserId',
        }),
      ]);
    });

    test('permission check defined on field fails', async () => {
      const query = gql`
        query {
          user(id: 1) {
            firstName
            lastName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message: 'Permission check on User.lastName failed.',
        }),
      ]);
    });
  });

  describe('query users', () => {
    test('without a user', async () => {
      const query = gql`
        query {
          users {
            id
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on Query.users failed. Missing the following permission: readUser',
        }),
      ]);
    });

    test('checks pass', async () => {
      const query = gql`
        query {
          users {
            firstName
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result.errors).toBeUndefined();

      expect(result.data).toEqual({
        users: [
          {
            firstName: 'Michael',
          },
          {
            firstName: 'Darth',
          },
        ],
      });
    });

    test('auth check defined on parent fails', async () => {
      const query = gql`
        query {
          users {
            firstName
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.email failed. Missing the following permission: readEmail',
        }),
      ]);

      expect(result.data).toEqual({
        users: [
          {
            firstName: 'Michael',
            email: 'michael.hayes@example.com',
          },
          null,
        ],
      });
    });

    test('granted auth check fails', async () => {
      const query = gql`
        query {
          users {
            id
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            'Permission check on User.id failed. Missing the following permission: readUserId',
        }),
        expect.objectContaining({
          message:
            'Permission check on User.id failed. Missing the following permission: readUserId',
        }),
      ]);

      expect(result.data).toEqual({
        users: [null, null],
      });
    });

    test('permission check defined on field fails', async () => {
      const query = gql`
        query {
          users {
            firstName
            lastName
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(2),
      });

      expect(result.errors).toEqual([
        expect.objectContaining({
          message: 'Permission check on User.lastName failed.',
        }),
      ]);

      expect(result.data).toEqual({
        users: [
          null,
          {
            firstName: 'Darth',
            lastName: 'Vader',
          },
        ],
      });
    });
  });

  describe('mutations', () => {
    test('createUser', async () => {
      const query = gql`
        mutation {
          createUser(firstName: "Foo", lastName: "Bar") {
            email
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(1),
      });

      expect(result.errors).toBeUndefined();

      expect(result.data).toEqual({
        createUser: {
          email: 'foo.bar@example.com',
        },
      });
    });
  });

  describe('shapes (Unions interfaces and postResolveCheck)', () => {
    test('query lots of shapes', async () => {
      const query = gql`
        query {
          square {
            name
            size
          }
          squareWithoutCheck {
            name
            size
          }
          rectangle(width: 10, height: 4) {
            area
          }
          rectangleFailsPermission: rectangle(height: 10, width: 4) {
            area
          }
          rectangleFailsPostResolve: rectangle(width: 10, height: -4) {
            area
          }
          rectangleNoGrantFromPreResolve: rectangle(height: 0, width: 1) {
            area
          }
          rectangleNoGrantFromPostResolve: rectangle(height: 1, width: 1) {
            area
          }
          oval {
            area
          }
          shapes {
            name
            ... on Square {
              size
            }
            ... on Triangle {
              edges
            }
            ... on Circle {
              area
            }
          }
          polygons {
            ... on Square {
              name
              size
            }
            ... on Triangle {
              name
              edges
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          square: {
            name: null,
            size: 16,
          },
          squareWithoutCheck: null,
          rectangle: {
            area: 40,
          },
          rectangleFailsPermission: {
            area: null,
          },
          rectangleFailsPostResolve: null,
          rectangleNoGrantFromPostResolve: {
            area: null,
          },
          rectangleNoGrantFromPreResolve: {
            area: null,
          },
          oval: null,
          shapes: [
            null,
            {
              name: 'square',
              size: 16,
            },
            {
              name: 'triangle',
              edges: null,
            },
          ],
          polygons: [
            {
              name: 'square',
              size: 16,
            },
            {
              name: 'triangle',
              edges: null,
            },
          ],
        },
        errors: [
          expect.objectContaining({
            message: 'Missing permission check on Query.squareWithoutCheck.',
            path: ['squareWithoutCheck'],
          }),
          expect.objectContaining({
            message: 'preResolveCheck failed for Query.oval on Oval',
            path: ['oval'],
          }),
          expect.objectContaining({
            message: 'postResolveCheck failed for Query.rectangle on Rectangle',
            path: ['rectangleFailsPostResolve'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Shape.name failed. Missing the following permission: readName',
            path: ['square', 'name'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permission: readRectangle',
            path: ['rectangleFailsPermission', 'area'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permission: preResolve',
            path: ['rectangleNoGrantFromPreResolve', 'area'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permissions: postResolve, readRectangle',
            path: ['rectangleNoGrantFromPostResolve', 'area'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Triangle.edges failed. Missing the following permission: readTriangle',
            path: ['shapes', 2, 'edges'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Triangle.edges failed. Missing the following permission: readTriangle',
            path: ['polygons', 1, 'edges'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Circle.area failed. Missing the following permission: readCircle',
            path: ['shapes', 0, 'area'],
          }),
        ],
      });
    });

    test('postResolveHook on interface implementors', async () => {
      const query = gql`
        query {
          thingWithCorners(width: 10, height: 4) {
            ... on Rectangle {
              area
            }
          }
          failsPermission: thingWithCorners(height: 10, width: 4) {
            ... on Rectangle {
              area
            }
          }
          failsPostResolve: thingWithCorners(width: 10, height: -4) {
            ... on Rectangle {
              area
            }
          }
          noGrantFromPreResolve: thingWithCorners(height: 0, width: 1) {
            ... on Rectangle {
              area
            }
          }
          noGrantFromPostResolve: thingWithCorners(height: 1, width: 1) {
            ... on Rectangle {
              area
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          thingWithCorners: {
            area: 40,
          },
          failsPermission: {
            area: null,
          },
          failsPostResolve: null,
          noGrantFromPostResolve: {
            area: null,
          },
          noGrantFromPreResolve: {
            area: null,
          },
        },
        errors: [
          expect.objectContaining({
            message: 'postResolveCheck failed for Query.thingWithCorners on Rectangle',
            path: ['failsPostResolve'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permission: readRectangle',
            path: ['failsPermission', 'area'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permission: preResolve',
            path: ['noGrantFromPreResolve', 'area'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permissions: postResolve, readRectangle',
            path: ['noGrantFromPostResolve', 'area'],
          }),
        ],
      });
    });

    test('preResolveHook on interface implementors', async () => {
      const query = gql`
        query {
          ovalThing {
            __typename
            ... on Oval {
              area
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          ovalThing: null,
        },
        errors: [
          expect.objectContaining({
            message: 'preResolveCheck failed for Query.ovalThing on Oval',
            path: ['ovalThing'],
          }),
        ],
      });
    });

    test('preResolveHook on union members', async () => {
      const query = gql`
        query {
          roundThing(oval: false) {
            __typename
            ... on Circle {
              area
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          roundThing: null,
        },
        errors: [
          expect.objectContaining({
            message: 'preResolveCheck failed for Query.roundThing on Oval',
            path: ['roundThing'],
          }),
        ],
      });
    });

    test('postResolveHook on union members', async () => {
      const query = gql`
        query {
          cornerUnion(width: 10, height: 4) {
            ... on Rectangle {
              area
            }
          }
          failsPermission: cornerUnion(height: 10, width: 4) {
            ... on Rectangle {
              area
            }
          }
          failsPostResolve: cornerUnion(width: 10, height: -4) {
            ... on Rectangle {
              area
            }
          }
          noGrantFromPreResolve: cornerUnion(height: 0, width: 1) {
            ... on Rectangle {
              area
            }
          }
          noGrantFromPostResolve: cornerUnion(height: 1, width: 1) {
            ... on Rectangle {
              area
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          cornerUnion: {
            area: 40,
          },
          failsPermission: {
            area: null,
          },
          failsPostResolve: null,
          noGrantFromPostResolve: {
            area: null,
          },
          noGrantFromPreResolve: {
            area: null,
          },
        },
        errors: [
          expect.objectContaining({
            message: 'postResolveCheck failed for Query.cornerUnion on Rectangle',
            path: ['failsPostResolve'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permission: readRectangle',
            path: ['failsPermission', 'area'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permission: preResolve',
            path: ['noGrantFromPreResolve', 'area'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Rectangle.area failed. Missing the following permissions: postResolve, readRectangle',
            path: ['noGrantFromPostResolve', 'area'],
          }),
        ],
      });
    });

    test('preResolveCheck on unions', async () => {
      const query = gql`
        query {
          preResolvePassUnion {
            ... on Line {
              length
            }
          }
          preResolveFailUnion {
            ... on Line {
              length
            }
          }
          postResolvePassUnion {
            ... on Line {
              length
            }
          }
          postResolveFailUnion {
            ... on Line {
              length
            }
          }
          skipMemberPreResolveUnion {
            ... on Line {
              length
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          preResolvePassUnion: {
            length: 3,
          },
          preResolveFailUnion: null,
          postResolvePassUnion: {
            length: 3,
          },
          postResolveFailUnion: null,
          skipMemberPreResolveUnion: {
            length: null,
          },
        },
        errors: [
          expect.objectContaining({
            message: 'preResolveCheck failed for Query.preResolveFailUnion on PreResolveFailUnion',
            path: ['preResolveFailUnion'],
          }),
          expect.objectContaining({
            message:
              'postResolveCheck failed for Query.postResolveFailUnion on PostResolveFailUnion',
            path: ['postResolveFailUnion'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Line.length failed. Missing the following permission: ranPreResolve',
            path: ['skipMemberPreResolveUnion', 'length'],
          }),
        ],
      });
    });

    test('preResolveCheck on interfaces', async () => {
      const query = gql`
        query {
          line {
            length
          }
          interfacePreResolvePass {
            ... on Line {
              length
            }
          }
          interfacePreResolveFail {
            ... on Line {
              length
            }
          }
          interfacePostResolvePass {
            ... on Line {
              length
            }
          }
          interfacePostResolveFail {
            ... on Line {
              length
            }
          }
          skipImplementorPreResolveChecks {
            ... on Line {
              length
            }
          }
        }
      `;

      const result = await execute({
        schema: authSchema,
        document: query,
        contextValue: createContext(0),
      });

      expect(result).toEqual({
        data: {
          line: {
            length: 3,
          },
          interfacePreResolvePass: {
            length: 3,
          },
          interfacePreResolveFail: null,
          interfacePostResolvePass: {
            length: 3,
          },
          interfacePostResolveFail: null,
          skipImplementorPreResolveChecks: {
            length: null,
          },
        },
        errors: [
          expect.objectContaining({
            message: 'preResolveCheck failed for Query.interfacePreResolveFail on PreResolveFail',
            path: ['interfacePreResolveFail'],
          }),
          expect.objectContaining({
            message:
              'postResolveCheck failed for Query.interfacePostResolveFail on PostResolveFail',
            path: ['interfacePostResolveFail'],
          }),
          expect.objectContaining({
            message:
              'Permission check on Line.length failed. Missing the following permission: ranPreResolve',
            path: ['skipImplementorPreResolveChecks', 'length'],
          }),
        ],
      });
    });
  });
});
