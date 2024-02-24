import { execute } from 'graphql';
import gql from 'graphql-tag';
import { createContext } from './example/context';
import schema from './example/schema';

describe('using byPath to implement a loadable connection', () => {
  it('valid queries', async () => {
    const query = gql`
      query {
        user(id: "2") {
          friends(first: 2) {
            edges {
              node {
                id
                friends(first: 1) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          }
          groupFriends(limit: 2) {
            id
            groupFriends(limit: 1) {
              id
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: createContext(),
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "friends": {
              "edges": [
                {
                  "node": {
                    "friends": {
                      "edges": [
                        {
                          "node": {
                            "id": "200",
                          },
                        },
                      ],
                    },
                    "id": "20",
                  },
                },
                {
                  "node": {
                    "friends": {
                      "edges": [
                        {
                          "node": {
                            "id": "210",
                          },
                        },
                      ],
                    },
                    "id": "21",
                  },
                },
              ],
            },
            "groupFriends": [
              {
                "groupFriends": [
                  {
                    "id": "200",
                  },
                ],
                "id": "20",
              },
              {
                "groupFriends": [
                  {
                    "id": "210",
                  },
                ],
                "id": "21",
              },
            ],
          },
        },
      }
    `);
  });
});
