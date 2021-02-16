/* eslint-disable no-console */
import { ApolloServer } from 'apollo-server';
import schema from './schema';
import User from './user';

const server = new ApolloServer({
  context: (ctx) => ({
    User: ctx.req.headers['x-user-id'] ? new User(ctx.req.headers) : null,
  }),
  schema,
});

server
  .listen(3000, () => {
    console.log('🚀 Server started at http://127.0.0.1:3000');
  })
  .catch(console.error);
