import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { createContext } from './context.ts';
import { schema } from './schema.ts';

const yoga = createYoga({
  schema,
  context: createContext,
});

const server = createServer(yoga);

const port = 3000;

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
