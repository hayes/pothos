import { ApolloServer } from 'apollo-server';
import { createContext } from './context';
import schema from './schema';

const server = new ApolloServer({
  schema,
  context: createContext,
});

server
  .listen(3000, () => {
    console.log('🚀 Server started at http://127.0.0.1:3000');
  })
  .catch(console.error);
