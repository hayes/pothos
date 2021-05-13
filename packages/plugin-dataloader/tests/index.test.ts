import { gql } from 'apollo-server';
import { execute, printSchema } from 'graphql';
import { createContext } from './example/context';
import schema from './example/schema';

describe('dataloader', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  describe('queries', () => {
    it('valid queries', async () => {
      const query = gql`
        query {
          counts {
            name
            calls
            loaded
          }
          users {
            id
          }
          user {
            id
          }
          userNodes {
            id
          }
          userNode {
            id
          }
          userNodes2: userNodes {
            id
          }
          userNode2: userNode {
            id
          }
          nodes(ids: ["VXNlck5vZGU6MTIz", "VXNlck5vZGU6NDU2"]) {
            id
          }
          user2: user(id: "2") {
            id
          }
          posts(ids: [123, 456]) {
            id
            title
            content
          }
          posts2: posts(ids: [123, 789]) {
            id
            title
            content
          }
          post(id: 1) {
            id
          }
          post2: post(id: 2) {
            id
          }
          fromContext1 {
            id
          }
          fromContext2 {
            id
          }
          fromContext3 {
            id
          }
          fromContext4 {
            id
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: createContext(),
      });

      expect(result).toMatchInlineSnapshot(`
        Object {
          "data": Object {
            "counts": Array [
              Object {
                "calls": 1,
                "loaded": 5,
                "name": "users",
              },
              Object {
                "calls": 1,
                "loaded": 3,
                "name": "userNodes",
              },
              Object {
                "calls": 1,
                "loaded": 3,
                "name": "posts",
              },
              Object {
                "calls": 1,
                "loaded": 2,
                "name": "post",
              },
            ],
            "fromContext1": Object {
              "id": "123",
            },
            "fromContext2": Object {
              "id": "456",
            },
            "fromContext3": Object {
              "id": "789",
            },
            "fromContext4": Array [
              Object {
                "id": "123",
              },
              Object {
                "id": "456",
              },
            ],
            "nodes": Array [
              Object {
                "id": "VXNlck5vZGU6MTIz",
              },
              Object {
                "id": "VXNlck5vZGU6NDU2",
              },
            ],
            "post": Object {
              "id": "1",
            },
            "post2": Object {
              "id": "2",
            },
            "posts": Array [
              Object {
                "content": "123 title",
                "id": "123",
                "title": "123 title",
              },
              Object {
                "content": "456 title",
                "id": "456",
                "title": "456 title",
              },
            ],
            "posts2": Array [
              Object {
                "content": "123 title",
                "id": "123",
                "title": "123 title",
              },
              Object {
                "content": "789 title",
                "id": "789",
                "title": "789 title",
              },
            ],
            "user": Object {
              "id": "1",
            },
            "user2": Object {
              "id": "2",
            },
            "userNode": Object {
              "id": "1",
            },
            "userNode2": Object {
              "id": "1",
            },
            "userNodes": Array [
              Object {
                "id": "VXNlck5vZGU6MTIz",
              },
              Object {
                "id": "VXNlck5vZGU6NDU2",
              },
              Object {
                "id": "VXNlck5vZGU6Nzg5",
              },
            ],
            "userNodes2": Array [
              Object {
                "id": "VXNlck5vZGU6MTIz",
              },
              Object {
                "id": "VXNlck5vZGU6NDU2",
              },
              Object {
                "id": "VXNlck5vZGU6Nzg5",
              },
            ],
            "users": Array [
              Object {
                "id": "123",
              },
              Object {
                "id": "456",
              },
              Object {
                "id": "789",
              },
            ],
          },
        }
      `);
    });

    it('query with errors', async () => {
      const query = gql`
        query {
          counts {
            name
            calls
            loaded
          }
          users(ids: ["-123", "-456", "789"]) {
            id
          }
          user(id: "-123") {
            id
          }
          userNodes(ids: ["-123", "-456", "789"]) {
            id
          }
          userNode(id: "-123") {
            id
          }
          user2: user(id: "2") {
            id
          }
          posts(ids: [-123, -456, 780]) {
            id
            title
            content
          }
          post(id: -1) {
            id
          }
          post2: post(id: 2) {
            id
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: createContext(),
      });

      expect(result.data).toMatchInlineSnapshot(`
        Object {
          "counts": Array [
            Object {
              "calls": 1,
              "loaded": 4,
              "name": "users",
            },
            Object {
              "calls": 1,
              "loaded": 3,
              "name": "userNodes",
            },
            Object {
              "calls": 1,
              "loaded": 3,
              "name": "posts",
            },
            Object {
              "calls": 1,
              "loaded": 2,
              "name": "post",
            },
          ],
          "post": null,
          "post2": Object {
            "id": "2",
          },
          "posts": Array [
            null,
            null,
            Object {
              "content": "780 title",
              "id": "780",
              "title": "780 title",
            },
          ],
          "user": null,
          "user2": Object {
            "id": "2",
          },
          "userNode": null,
          "userNodes": Array [
            null,
            null,
            Object {
              "id": "VXNlck5vZGU6Nzg5",
            },
          ],
          "users": Array [
            null,
            null,
            Object {
              "id": "789",
            },
          ],
        }
      `);
      expect(result.errors).toMatchInlineSnapshot(`
        Array [
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -456],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -456],
          [GraphQLError: Invalid ID -1],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -456],
        ]
      `);
    });
  });
});
