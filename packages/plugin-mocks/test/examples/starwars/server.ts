import { ApolloServer } from 'apollo-server';
import schema from './schema';

const server = new ApolloServer({
  schema,
});

server.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
