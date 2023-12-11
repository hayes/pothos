import { startStandaloneServer } from '@apollo/server/standalone';
import { createGateway } from './gateway';
import { startServers } from './servers';

startServers()
  .then(async (configs) => {
    const server = createGateway(configs);

    const { url } = await startStandaloneServer(server);

    console.log(`🚀 Server ready at ${url}`);
  })
  // eslint-disable-next-line unicorn/prefer-top-level-await
  .catch((error) => {
    throw error;
  });
