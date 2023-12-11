/* eslint-disable jest/no-conditional-in-test */
import { execute, lexicographicSortSchema, parse, printSchema, validate } from 'graphql';
import { gql } from 'graphql-tag';
import { createComplexityRule } from '../src';
import { complexityFromQuery } from '../src/util';
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
            friendsUnion {
              __typename
            }
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

  describe('complexity from query', () => {
    it('as string', () => {
      const query = /* graphql */ `
        query {
          hero(episode: EMPIRE) {
            friends(limit: 2) {
              ...CharacterFields
            }
          }
        }

        fragment CharacterFields on Character {
          name
          friends(limit: 10) {
            friends(limit: 1) {
              appearsIn
              name
            }
          }
        }
      `;

      const result = complexityFromQuery(query, { schema: exampleSchema });
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative limits', () => {
    const limitTypes = ['depth', 'breadth', 'complexity'] as const;

    limitTypes.forEach((limit) => {
      it(`negative ${limit}`, async () => {
        const query = gql`
          query {
            hero(episode: EMPIRE) {
              name
            }
          }
        `;

        const result = await execute({
          schema: exampleSchema,
          document: query,
          contextValue: {
            complexity: {
              depth: limit === 'depth' ? -1 : 10,
              breadth: limit === 'breadth' ? -1 : 10,
              complexity: limit === 'complexity' ? -1 : 10,
            },
          },
        });

        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('zero limits', () => {
    const limitTypes = ['depth', 'breadth', 'complexity'] as const;

    limitTypes.forEach((limit) => {
      it(`zero ${limit}`, async () => {
        const query = gql`
          query {
            hero(episode: EMPIRE) {
              name
            }
          }
        `;

        const result = await execute({
          schema: exampleSchema,
          document: query,
          contextValue: {
            complexity: {
              depth: limit === 'depth' ? 0 : 10,
              breadth: limit === 'breadth' ? 0 : 10,
              complexity: limit === 'complexity' ? 0 : 10,
            },
          },
        });

        expect(result).toMatchSnapshot();
      });
    });
  });
});

describe('createComplexityRule', () => {
  it('checks complexity', () => {
    const results = validate(
      exampleSchema,
      parse(/* GraphQL */ `
        query {
          hero(episode: EMPIRE) {
            friends {
              ...CharacterFields
            }
          }
        }

        fragment CharacterFields on Character {
          name
          friends {
            friends {
              appearsIn
              name
            }
          }
        }
      `),
      [
        createComplexityRule({
          maxDepth: 1,
          maxBreadth: 1,
          maxComplexity: 200,
          variableValues: {},
          context: {},
        }),
      ],
    );

    expect(results).toMatchInlineSnapshot(`
      [
        [GraphQLError: Query complexity of 287 exceeds max complexity of 200],
        [GraphQLError: Query depth of 5 exceeds max depth of 1],
        [GraphQLError: Query breadth of 7 exceeds max breadth of 1],
      ]
    `);

    expect(results.map((result) => result.extensions)).toMatchInlineSnapshot(`
      [
        {
          "code": "QUERY_COMPLEXITY",
          "queryComplexity": {
            "actual": 287,
            "max": 200,
          },
        },
        {
          "code": "QUERY_DEPTH",
          "queryDepth": {
            "actual": 5,
            "max": 1,
          },
        },
        {
          "code": "QUERY_BREADTH",
          "queryBreadth": {
            "actual": 7,
            "max": 1,
          },
        },
      ]
    `);
  });

  it('negative limits', () => {
    const results = validate(
      exampleSchema,
      gql`
        query {
          hero(episode: EMPIRE) {
            name
          }
        }
      `,
      [
        createComplexityRule({
          maxDepth: -1,
          maxBreadth: -1,
          maxComplexity: -1,
          variableValues: {},
          context: {},
        }),
      ],
    );

    expect(results).toMatchSnapshot();
  });

  it('zero limits', () => {
    const results = validate(
      exampleSchema,
      gql`
        query {
          hero(episode: EMPIRE) {
            name
          }
        }
      `,
      [
        createComplexityRule({
          maxDepth: 0,
          maxBreadth: 0,
          maxComplexity: 0,
          variableValues: {},
          context: {},
        }),
      ],
    );

    expect(results).toMatchSnapshot();
  });
});
