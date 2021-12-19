import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import exampleSchema from './example/schema';

describe('simple objects example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  describe('queries', () => {
    it('valid query', async () => {
      const query = gql`
        query {
          hero(episode: EMPIRE) {
            friends {
              __typename
              ... on Character {
                name
                friends {
                  friends {
                    name
                  }
                }
              }
            }
          }
        }
      `;

      const result = await execute({
        schema: exampleSchema,
        document: query,
        contextValue: {
          complexity: {
            depth: 5,
            breadth: 10,
            complexity: 200,
          },
        },
      });

      expect(result).toMatchSnapshot();
    });

    it('too complex', async () => {
      const query = gql`
        query {
          hero(episode: EMPIRE) {
            friends {
              ... on Character {
                name
                friends {
                  friends {
                    appearsIn
                    name
                  }
                }
              }
            }
          }
        }
      `;

      const result = await execute({
        schema: exampleSchema,
        document: query,
        contextValue: {
          complexity: {
            depth: 5,
            breadth: 10,
            complexity: 200,
          },
        },
      });

      expect(result).toMatchSnapshot();
    });

    it('complexity based on args', async () => {
      const query = gql`
        query {
          hero(episode: EMPIRE) {
            friends(limit: 1) {
              ... on Character {
                name
                friends(limit: 1) {
                  friends(limit: 1) {
                    appearsIn
                    name
                  }
                }
              }
            }
          }
        }
      `;

      const result = await execute({
        schema: exampleSchema,
        document: query,
        contextValue: {
          complexity: {
            depth: 5,
            breadth: 10,
            complexity: 200,
          },
        },
      });

      expect(result).toMatchSnapshot();
    });

    it('complexity based options', async () => {
      const query = gql`
        query {
          human(id: 1) {
            name
          }
        }
      `;

      const result = await execute({
        schema: exampleSchema,
        document: query,
        contextValue: {
          complexity: {
            depth: 5,
            breadth: 10,
            complexity: 200,
          },
        },
      });

      expect(result).toMatchSnapshot();
    });

    it('too deep', async () => {
      const query = gql`
        query {
          hero(episode: EMPIRE) {
            friends {
              ... on Character {
                name
                friends {
                  friends {
                    friends {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await execute({
        schema: exampleSchema,
        document: query,
        contextValue: {
          complexity: {
            depth: 5,
            breadth: 10,
            complexity: 200,
          },
        },
      });

      expect(result).toMatchSnapshot();
    });

    it('too wide', async () => {
      const query = gql`
        query {
          hero(episode: EMPIRE) {
            name1: name
            name2: name
            name3: name
            name4: name
            ... {
              name1: name
              name2: name
              name3: name
              name4: name
            }
            ... on Character {
              name1: name
              name2: name
              name3: name
              name4: name
            }
          }
        }
      `;

      const result = await execute({
        schema: exampleSchema,
        document: query,
        contextValue: {
          complexity: {
            depth: 5,
            breadth: 10,
            complexity: 200,
          },
        },
      });

      expect(result).toMatchSnapshot();
    });
  });
});
