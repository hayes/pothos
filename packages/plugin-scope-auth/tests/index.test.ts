import { gql } from 'apollo-server';
import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import builder from './example/builder';
import exampleSchema from './example/schema';
import User from './example/user';

describe('example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  test('with disabled scope auth', async () => {
    const query = gql`
      query {
        forAdmin
      }
    `;

    const result = await execute({
      schema: builder.toSchema({ disableScopeAuth: true }),
      document: query,
      contextValue: {
        user: new User({
          'x-user-id': '1',
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "forAdmin": "ok",
        },
      }
    `);
  });
});
