/* eslint-disable no-console */
import { ApolloServer } from 'apollo-server';
import schema from './schema';

const server = new ApolloServer({
  schema,
});

server.listen(3000).catch(console.error);
