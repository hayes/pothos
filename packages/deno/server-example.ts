import { Application, Router } from 'https://deno.land/x/oak@v7.3.0/mod.ts';
// Currently the way helix exports graphiql doesn't work in deno, so we import the other parts directly, and import a very simple playground file from a gist.
import { shouldRenderGraphiQL } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/should-render-graphiql.ts';
import { processRequest } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/process-request.ts';
import { getGraphQLParameters } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/get-graphql-parameters.ts';
import playground from 'https://gist.githubusercontent.com/hayes/5c99f7b4f71234452036fd88e142a825/raw/655245a052b10c2912a803c8a6d537096b73c10b/playground.ts';
// GiraphQL
import SchemaBuilder from './packages/core/mod.ts';

// Create app and router
const app = new Application();
const router = new Router();

// Create a very simple schema
const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({}),
      },
      resolve: (parent, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});

const schema = builder.toSchema({});

// Mount a route to serve the graphql API and playground
router.all('/graphql', async (context) => {
  // parse request
  const request = {
    body: await context.request.body({}).value,
    headers: context.request.headers,
    method: context.request.method,
    query: context.request.url.searchParams,
  };

  if (shouldRenderGraphiQL(request)) {
    context.response.body = playground({ endpoint: 'localhost:8080/graphql' });

    return;
  }
  // Extract the GraphQL parameters from the request
  const { operationName, query, variables } = getGraphQLParameters(request);

  // Validate and execute the query
  const result = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
  });

  if (result.type === 'RESPONSE') {
    // We set the provided status and headers and just the send the payload back to the client
    result.headers.forEach(({ name, value }) => context.response.headers.set(name, value));

    context.response.status = result.status;
    context.response.body = result.payload;
  } else {
    // Omitting other response types for brevity, see graphql-helix docs for more a complete implementation
    throw new Error('Unsupported result type');
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log('Go to http://localhost:8080/graphql to open the playground');
await app.listen({ port: 8080 });
