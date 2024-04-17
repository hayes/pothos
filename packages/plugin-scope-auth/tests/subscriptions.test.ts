import { subscribe } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './example/schema';
import User from './example/user';

describe('subscriptions', () => {
  it('blocks unauthorized subscriptions before subscribing', async () => {
    const query = gql`
      subscription {
        count
      }
    `;

    const result = await subscribe({
      schema,
      document: query,
      contextValue: {
        user: new User({
          'x-user-id': '1',
        }),
      },
    });

    let i = 0;
    for await (const value of result as AsyncIterable<unknown>) {
      expect(value).toMatchInlineSnapshot(`
        {
          "data": {
            "count": ${i},
          },
        }
      `);

      i += 1;
    }

    expect(i).toBe(3);

    const unauthorizedResult = await subscribe({
      schema,
      document: query,
      contextValue: {},
    });

    expect(unauthorizedResult).toMatchInlineSnapshot(`
      {
        "errors": [
          [GraphQLError: Not authorized to resolve Subscription.count],
        ],
      }
    `);
  });
});
