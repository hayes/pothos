/* eslint-disable unicorn/prefer-top-level-await */
import { createServer } from 'node:http';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as express from 'express';
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createContext, defaultContext } from './context';
import { schema as schemaPothos } from './schema';

const PORT = 4020;

const app = express();
const httpServer = createServer(app);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

const schema = schemaPothos;
const serverCleanup = useServer(
  {
    schema,
    context: () => defaultContext,
  },
  wsServer,
);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      // eslint-disable-next-line @typescript-eslint/require-await
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

(async () => {
  await server.start();
  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    bodyParser.json(),
    expressMiddleware(server, { context: createContext }),
  );
})();

httpServer.listen(PORT, () => {
  console.log(`🚀 Query endpoint ready at http://localhost:${PORT}/graphql`);
  console.log(`🚀 Subscription endpoint ready at ws://localhost:${PORT}/graphql`);
});
