import { ApolloServer } from 'apollo-server';
import schema from './schema';
import { User } from './data';

const server = new ApolloServer({
  schema,
  context: ctx => {
    const userID = parseInt((ctx.req.headers['user-id'] as string) || '0', 10);
    const role = User.map.get(userID) ? User.map.get(userID)!.role : 'Guest';

    return {
      userID,
      role,
      User,
    };
  },
});

server.listen(3000);
