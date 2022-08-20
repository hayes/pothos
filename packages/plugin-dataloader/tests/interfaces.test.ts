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
        animals(ids: [1, 2, 3, 4, 1, 2, 3, 4]) {
          type
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
          "animals": [
            {
              "__typename": "Cat",
              "chasingMouse": false,
              "type": "Cat",
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
              "type": "Dog",
            },
            {
              "__typename": "Cat",
              "chasingMouse": false,
              "type": "Cat",
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
              "type": "Dog",
            },
            {
              "__typename": "Cat",
              "chasingMouse": false,
              "type": "Cat",
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
              "type": "Dog",
            },
            {
              "__typename": "Cat",
              "chasingMouse": false,
              "type": "Cat",
            },
            {
              "__typename": "Dog",
              "chasingTail": true,
              "type": "Dog",
            },
          ],
          "counts": [
            {
              "calls": 1,
              "loaded": 4,
              "name": "animals",
            },
          ],
        },
      }
    `);
  });
});
