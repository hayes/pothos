import { ApolloServer } from 'apollo-server';
import { ApolloGateway } from '@apollo/gateway';

export const gateway = new ApolloGateway({
  serviceList: [
    {
      name: 'accounts',
      url: 'http://localhost:4001/',
    },
    {
      name: 'inventory',
      url: 'http://localhost:4002/',
    },
    {
      name: 'products',
      url: 'http://localhost:4003/',
    },
    {
      name: 'reviews',
      url: 'http://localhost:4004/',
    },
  ],
});

const server = new ApolloServer({
  gateway,
});

server
  .listen()
  .then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  })
  .catch((error) => {
    throw error;
  });
