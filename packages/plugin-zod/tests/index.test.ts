import { gql } from 'apollo-server';
import { execute } from 'graphql';
import schema from './example/schema';

describe('mocked', () => {
  test('valid query', async () => {
    const query = gql`
      query {
        requiresOddArg(odd: 1)
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchSnapshot();
  });

  test('invalid query', async () => {
    const query = gql`
      query {
        requiresOddArg(odd: 2)
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
