import { execute } from 'graphql';
import gql from 'graphql-tag';
import { createContext } from './example/context';
import schema from './example/schema';

describe('loadableInterface', () => {
  it('query', async () => {
    const query = gql`
      query {
        counts {
          name
          calls
          loaded
        }
        pets(ids: [1, 2, 3, 4, 1, 2, 3, 4]) {
          __typename
          ... on Dog {
            chasingTail
          }
          ... on Cat {
            chasingMouse
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
          "counts": [
            {
              "calls": 1,
              "loaded": 4,
              "name": "pets",
            },
          ],
          "pets": [
            {
              "__typename": "Cat",
              "chasingMouse": false,
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
            },
            {
              "__typename": "Cat",
              "chasingMouse": false,
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
            },
            {
              "__typename": "Cat",
              "chasingMouse": false,
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
            },
            {
              "__typename": "Cat",
              "chasingMouse": false,
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
            },
          ],
        },
      }
    `);
  });
});
