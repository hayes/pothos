/* eslint-disable no-console */
import { ApolloServer } from 'apollo-server';
import schema from './schema';
import { User } from './data';

const server = new ApolloServer({
  schema,
  context: () => ({
    User,
  }),
});

server.listen(3000).catch(console.error);
