import { ApolloServer } from 'apollo-server';
import schema from './schema';
import { createContext } from './data';

const server = new ApolloServer({
  schema,
  context: (ctx) => {
    const userID = parseInt((ctx.req.headers['x-user-id'] as string) || '0', 10);

    return createContext(userID);
  },
});

server.listen(3000);
