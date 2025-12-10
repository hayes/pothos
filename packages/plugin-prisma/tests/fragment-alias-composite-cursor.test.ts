import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('prisma - fragment alias with different fields', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should merge fields when fragments share alias but request different fields', async () => {
    const query = gql`
      query {
        me {
          id
          ...FragmentA
          ...FragmentB
        }
      }

      fragment FragmentA on User {
        postsAlias: postNodes(limit: 5) {
          id
          title
        }
      }

      fragment FragmentB on User {
        postsAlias: postNodes(limit: 5) {
          id
          content
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "id": "VXNlcjox",
            "postsAlias": [
              {
                "content": "Iusto odit nisi aliquid nostrum similique libero. Iure velit ipsa quidem aliquid. Cum similique qui reprehenderit dolores veritatis voluptatum. Voluptatum vel culpa magnam illum dignissimos nam cum. Corporis nam commodi ad animi corporis voluptas.",
                "id": "U2VsZWN0UG9zdDox",
                "title": "Quos distinctio distinctio dignissimos vel quo maiores ea.",
              },
              {
                "content": "Officiis vel nobis debitis quidem. Laudantium blanditiis quam error excepturi dicta aliquam enim ducimus commodi. Pariatur voluptates non beatae iusto ducimus doloribus consectetur.",
                "id": "U2VsZWN0UG9zdDoy",
                "title": "Voluptatem eum dolores dignissimos quia vel.",
              },
              {
                "content": "Dolorum at vero modi praesentium esse est modi. Temporibus error tempora laborum voluptatum quibusdam dolores. Enim optio debitis. Eos sequi dignissimos sint.",
                "id": "U2VsZWN0UG9zdDoz",
                "title": "Ut corrupti eum nostrum consequatur aliquam nostrum.",
              },
              {
                "content": "Ad laudantium harum. Quos ipsum laboriosam nemo recusandae fugiat quibusdam expedita corporis nisi. Consectetur aliquam suscipit. Corrupti facilis quas repellat alias ullam. Optio ipsa provident doloremque harum vero sed dolore.",
                "id": "U2VsZWN0UG9zdDo0",
                "title": "Aut molestiae perspiciatis quaerat quas praesentium quia ut sed cumque.",
              },
              {
                "content": "Dolore quos facere fugiat quas laboriosam dolorum enim placeat. At dolores autem assumenda ipsa. Iusto quos totam occaecati occaecati.",
                "id": "U2VsZWN0UG9zdDo1",
                "title": "Quos beatae adipisci explicabo officiis ad esse id.",
              },
            ],
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "posts": {
                "select": {
                  "content": true,
                  "id": true,
                  "title": true,
                },
                "take": 5,
                "where": undefined,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
      ]
    `);
  });
});
