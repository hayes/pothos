import { ApolloGateway } from '@apollo/gateway';

const gateway = new ApolloGateway({
  serviceList: [
    {
      name: 'accounts',
      url: 'http://localhost:4001/graphql',
    },
    {
      name: 'inventory',
      url: 'http://localhost:4002/graphql',
    },
    {
      name: 'products',
      url: 'http://localhost:4003/graphql',
    },
    {
      name: 'reviews',
      url: 'http://localhost:4004/graphql',
    },
  ],
});
