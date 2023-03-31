import './examples/starwars/schema';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { builder } from './examples/starwars/builder';

describe('mocked', () => {
  it('query some stuff', async () => {
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
