import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import exampleSchema from './examples/simple/schema';

describe('simple objects example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
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
