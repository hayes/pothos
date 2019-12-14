import { printSchema, execute } from 'graphql';
import gql from 'graphql-tag';
import starwarsSchema from './examples/starwars/schema';

import Character from './examples/starwars/schema/character';
import Droid from './examples/starwars/schema/droid';
import { Episode, MoreEpisodes } from './examples/starwars/schema/episode';
import Human from './examples/starwars/schema/human';
import Query, { extraQueryFields } from './examples/starwars/schema/query';

import builder from './examples/starwars/builder';

describe('starwars example', () => {
  test('generates expected schema', () => {
    expect(printSchema(starwarsSchema)).toMatchSnapshot();
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
              appearsIn(id: 4)
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
              appearsIn(id: 4)
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
      });

      expect(result).toMatchSnapshot();
    });
  });
});

describe('mocked', () => {
  const mockedSchema = builder.toSchema([Character, Droid, Episode, Human, MoreEpisodes, Query], {
    fieldDefinitions: [extraQueryFields],
    mocks: {
      Character: {
        name: () => 'C-3PO',
      },
    },
  });

  test('query some stuff', async () => {
    const query = gql`
      query {
        r2d2 {
          name
        }
      }
    `;

    const result = await execute({
      schema: mockedSchema,
      document: query,
    });

    expect(result).toMatchSnapshot();
  });
});
