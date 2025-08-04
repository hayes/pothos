import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { createContext } from './context';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  context: createContext,
});

const server = createServer(yoga);

const port = 3000;

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
