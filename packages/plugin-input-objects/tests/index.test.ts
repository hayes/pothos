import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './examples/starwars/schema';

describe('input objects', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(schema))).toMatchSnapshot();
  });

  describe('queries', () => {
    it('uses default input name', async () => {
      const query = gql`
        query {
          human(input: { id: "1002" }) {
            name
          }
        }
      `;

      const result = await execute({ schema, document: query });

      expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "human": Object {
      "name": "Han Solo",
    },
  },
}
`);
    });

    it('uses custom options name', async () => {
      const query = gql`
        query {
          hero(options: { episode: NEWHOPE }) {
            name
          }
        }
      `;

      const result = await execute({ schema, document: query });

      expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "hero": Object {
      "name": "R2-D2",
    },
  },
}
`);
    });
  });
});
