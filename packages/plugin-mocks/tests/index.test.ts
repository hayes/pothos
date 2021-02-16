import './examples/starwars/schema';
import { gql } from 'apollo-server';
import { execute } from 'graphql';
import builder from './examples/starwars/builder';

describe('mocked', () => {
  test('query some stuff', async () => {
    const mockedSchema = builder.toSchema({
      mocks: {
        Character: {
          name: () => 'C-3PO',
        },
      },
    });

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
      contextValue: {},
    });

    expect(result).toMatchSnapshot();
  });
});
