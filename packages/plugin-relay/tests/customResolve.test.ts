import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './examples/custom-resolve/schema';

describe('custom node resolve', () => {
  it('resolves a node with a global id', async () => {
    const query = gql`
      query {
        node(id: "VXNlcjo4") {
          ... on User {
            age
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
