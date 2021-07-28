import { ApolloServer } from 'apollo-server';
import { prisma } from './builder';
import schema from './schema';

const server = new ApolloServer({
  schema,
  context: () => ({
    user: {
      id: 1,
    },
  }),
});

prisma.$on('query', (e) => {
  console.log(`Query: ${e.query}`);
  console.log(`Duration: ${e.duration}ms`);
});

server
  .listen(3000, () => {
    console.log('🚀 Server started at http://127.0.0.1:3000');
  })
  .catch(console.error);
