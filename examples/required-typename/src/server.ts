import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  graphiql: {
    defaultQuery: `
query ExampleQuery {
  pets {
    __typename
    ... on Dog {
      name
      breed
    }
    ... on Cat {
      name
      livesRemaining
    }
  }
  nodes {
    __typename
    id
    ... on Person {
      name
    }
    ... on Company {
      companyName
    }
  }
}
    `.trim(),
  },
});

const server = createServer(yoga);

const port = 4000;
server.listen(port, () => {
  console.log(`🚀 Server ready at http://localhost:${port}/graphql`);
});
