/* eslint-disable no-console */
import { ApolloServer } from 'apollo-server';
import schema from './schema';
import { createContext } from './data';

const server = new ApolloServer({
  schema,
  context: (ctx) => {
    const userID = Number.parseInt((ctx.req.headers['x-user-id'] as string) || '0', 10);

    return createContext(userID);
  },
});

server
  .listen(3000)
  .then(() => void console.log('listening at http://127.0.0.1:3000'))
  .catch(console.error);
