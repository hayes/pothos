import axios from 'axios';
import { printSchema } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { printSubgraphSchema } from '@apollo/subgraph';
import { schema as accountsSchema } from './example/accounts/schema';
import { createGateway } from './example/gateway';
import { schema as inventorySchema } from './example/inventory/schema';
import { schema as productsSchema } from './example/products/schema';
import { schema as reviewsSchema } from './example/reviews/schema';
import { startServers } from './example/servers';

describe('federation', () => {
  describe('accounts schema', () => {
    it('generates expected schema', () => {
      expect(printSubgraphSchema(accountsSchema)).toMatchSnapshot();
      expect(printSchema(accountsSchema)).toMatchSnapshot();
    });
  });

  describe('inventory schema', () => {
    it('generates expected schema', () => {
      expect(printSubgraphSchema(inventorySchema)).toMatchSnapshot();
      expect(printSchema(inventorySchema)).toMatchSnapshot();
    });
  });

  describe('products schema', () => {
    it('generates expected schema', () => {
      expect(printSubgraphSchema(productsSchema)).toMatchSnapshot();
      expect(printSchema(productsSchema)).toMatchSnapshot();
    });
  });

  describe('reviews schema', () => {
    it('generates expected schema', () => {
      expect(printSubgraphSchema(reviewsSchema)).toMatchSnapshot();
      expect(printSchema(reviewsSchema)).toMatchSnapshot();
    });
  });

  describe('superGraph', () => {
    let gatewayUrl!: string;
    let servers!: { server: ApolloServer; name: string; url: string }[];
    let gateway!: ApolloServer;

    beforeAll(async () => {
      servers = await startServers();
      gateway = createGateway(servers);

      const { url } = await startStandaloneServer(gateway, { listen: { port: 0 } });

      gatewayUrl = url;
    });

    afterAll(async () => {
      await Promise.all(servers.map(({ server }) => server.stop()));
      await gateway.stop();
    });

    it('resolves query across multiple schemas', async () => {
      const { data } = await axios.post(gatewayUrl, {
        query: /* graphql */ `
         query {
            me {
              id
              name
              username
              reviews {
                id
                body
                author {
                  username
                  reviews {
                    id
                    product {
                      upc
                      weight
                      price
                      inStock
                      shippingEstimate
                      name
                    }
                  }
                }
              }
            }
          }
        `,
      });

      expect(data).toMatchInlineSnapshot(`
        {
          "data": {
            "me": {
              "id": "1",
              "name": "Ada Lovelace",
              "reviews": [
                {
                  "author": {
                    "reviews": [
                      {
                        "id": "1",
                        "product": {
                          "inStock": true,
                          "name": "Table",
                          "price": 899,
                          "shippingEstimate": 50,
                          "upc": "1",
                          "weight": 100,
                        },
                      },
                      {
                        "id": "2",
                        "product": {
                          "inStock": false,
                          "name": "Couch",
                          "price": 1299,
                          "shippingEstimate": 0,
                          "upc": "2",
                          "weight": 1000,
                        },
                      },
                    ],
                    "username": "@ada",
                  },
                  "body": "Love it!",
                  "id": "1",
                },
                {
                  "author": {
                    "reviews": [
                      {
                        "id": "1",
                        "product": {
                          "inStock": true,
                          "name": "Table",
                          "price": 899,
                          "shippingEstimate": 50,
                          "upc": "1",
                          "weight": 100,
                        },
                      },
                      {
                        "id": "2",
                        "product": {
                          "inStock": false,
                          "name": "Couch",
                          "price": 1299,
                          "shippingEstimate": 0,
                          "upc": "2",
                          "weight": 1000,
                        },
                      },
                    ],
                    "username": "@ada",
                  },
                  "body": "Too expensive.",
                  "id": "2",
                },
              ],
              "username": "@ada",
            },
          },
        }
      `);
    });
  });
});
