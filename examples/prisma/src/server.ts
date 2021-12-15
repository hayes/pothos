import { ApolloServer } from 'apollo-server';
import { schema } from './schema';

const PORT = 3000;

export const server = new ApolloServer({
  schema,
});

void server.listen(PORT, (error: unknown) => {
  if (error) {
    throw error;
  }

  console.log(`🚀 Server started at http://127.0.0.1:${PORT}`);
});
