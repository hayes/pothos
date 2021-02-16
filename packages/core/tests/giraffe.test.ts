import { execute, lexicographicSortSchema,printSchema } from 'graphql';
import gql from 'graphql-tag';
import schema from './examples/giraffes';

describe('giraffe example', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(schema))).toMatchSnapshot();
  });

  describe('queries', () => {
    test('query some stuff', async () => {
      const query = gql`
        query {
          date
          positive
          giraffe {
            diet
            name
            age
            height(unit: Meters)
            heightInFeet: height(unit: Feet)
          }
          giraffeClass {
            diet
            name
            age
          }
          giraffeRef {
            diet
            name
            age
          }
          animal {
            diet
            ... on Giraffe {
              name
            }
          }
          animalRef {
            diet
            ... on GiraffeFromRef {
              name
            }
          }

          animalClass {
            diet
            ... on GiraffeFromClass {
              name
            }
          }
          giraffeFacts {
            __typename
            ... on GiraffeStringFact {
              fact
            }
            ... on GiraffeNumericFact {
              fact
              value
            }
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('mutations', () => {
    test('mutate some stuff', async () => {
      const query = gql`
        mutation {
          createGiraffe(input: { name: "James", birthdate: "12/12/2020", height: 10 }) {
            name
            age
            diet
          }
          createGiraffeWithFriends(
            input: {
              name: "James"
              birthdate: "12/12/2017"
              height: 10
              friends: [{ name: "Gina", birthdate: "5/5/2005", height: 12 }]
            }
          ) {
            name
            age
            diet
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });
  });
});
