import { ApolloServer } from 'apollo-server';
import { User } from './data';
import schema from './schema';

const server = new ApolloServer({
  schema,
  context: () => ({
    User,
  }),
});

void server.listen(3000);
