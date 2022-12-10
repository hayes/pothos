import { createServer } from 'http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const yoga = createYoga({
  schema,
});

const server = createServer(yoga);

const port = 3000;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}/graphql`);
});
