import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import extendSchema from './examples/extend/schema';
import exampleSchema from './examples/simple/schema';

describe('simple objects example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchInlineSnapshot(`
      "type AddedUser implements Node {
        id: ID!
        name: String
        posts: [Post!]
        profile: Profile
      }

      type ExtraType {
        extra: String
      }

      type ExtraTypeFromSchema {
        extra: String
      }

      interface Node {
        id: ID!
      }

      type Post implements Node {
        content: String
        id: ID!
        postTitle: String
      }

      type Profile implements Node {
        bio: String
        id: ID!
      }

      type Query {
        extra: ExtraType
        extraFromSchema: ExtraTypeFromSchema
        posts: [Post!]
        user(id: ID!): AddedUser
      }"
    `);
    expect(printSchema(lexicographicSortSchema(extendSchema))).toMatchInlineSnapshot(`
      "interface Node {
        id: ID!
      }

      type Post implements Node {
        content: String
        id: ID!
        title: String
      }

      type Profile implements Node {
        bio: String
        id: ID!
      }

      type Query {
        posts: [Post!]
        user(id: ID!): User
      }

      type User implements Node {
        id: ID!
        name: String
        posts: [Post!]
        profile: Profile
      }"
    `);
  });

  it('resolves values from imported types', async () => {
    const query = gql`
      query {
        user(id: "1") {
          id
          name
          profile {
            bio
          }
          posts {
            id
            postTitle
          }
        }
        posts {
          id
          postTitle
          title
        }
        extra {
          extra
        }
        extraFromSchema {
          extra
        }
      }
    `;

    const result = await execute({ schema: exampleSchema, document: query, contextValue: {} });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "extra": {
            "extra": "extra",
          },
          "extraFromSchema": {
            "extra": "extra",
          },
          "posts": [
            {
              "id": "123",
              "postTitle": "title",
            },
          ],
          "user": {
            "id": "1",
            "name": "User name",
            "posts": [
              {
                "id": "123",
                "postTitle": "title",
              },
            ],
            "profile": {
              "bio": "example bio",
            },
          },
        },
      }
    `);
  });
});
