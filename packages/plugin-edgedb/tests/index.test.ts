import schema from './example/schema';
import { db as edgedb } from './example/db';
import { execute, printSchema } from 'graphql';
import { gql } from 'graphql-tag';

let queries = [];

describe('edgedb', () => {
  afterEach(() => {
    queries = [];
  });

  it('generates schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  it('queries for single item', async () => {
    const query = gql`
      query {
        me {
          id
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 'a04bf8b8-1bfd-11ed-93f8-836b78753212' } },
    });

    console.log('result::', result);

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "me": null,
        },
        "errors": Array [
          [GraphQLError: Cannot return null for non-nullable field ExplicitEdgeDBUser.id.],
        ],
      }
    `);
  });
});
