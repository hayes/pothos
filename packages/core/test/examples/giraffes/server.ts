import { ApolloServer } from 'apollo-server';
import schema from '.';

const server = new ApolloServer({ schema });

server.listen(8000, (error: unknown) => {
  if (error) {
    throw error;
  }

  console.log('🚀 Server started at http://127.0.0.1:8000');
});
