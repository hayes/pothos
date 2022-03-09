import { createGateway } from './gateway';
import { startServers } from './servers';

startServers()
  .then(async (configs) => {
    const server = createGateway(configs);

    const { url } = await server.listen();

    console.log(`🚀 Server ready at ${url}`);
  })
  .catch((error) => {
    throw error;
  });
