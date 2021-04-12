import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import gql from 'graphql-tag';
import starwarsSchema from './examples/starwars/schema';

describe('starwars example', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(starwarsSchema))).toMatchSnapshot();
  });

  describe('queries', () => {
    test('query some stuff', async () => {
      const query = gql`
        query {
          droid(id: 2001) {
            name
            primaryFunction
            friends {
              name
              appearsIn
              ... on Human {
                homePlanet
              }
              ... on Droid {
                primaryFunction
              }
            }
          }
          human(id: 1001) {
            name
            homePlanet
            friends {
              name
              appearsIn
            }
          }
          hero(episode: NEWHOPE) {
            name
          }
          r2d2 {
            name
          }
        }
      `;

      const result = await execute({
        schema: starwarsSchema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });
  });
});
