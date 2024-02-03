import { startStandaloneServer } from '@apollo/server/standalone';
import { server as reviewsServer } from './reviews';
import { server as productsServer } from './products';

export const servers = [
  { name: 'products', server: productsServer },
  { name: 'reviews', server: reviewsServer },
];

export async function startServers() {
  return Promise.all(
    servers.map(async ({ server, name }) => {
      const { url } = await startStandaloneServer(server, { listen: { port: 0 } });

      console.log(name, url);

      return { name, url, server };
    }),
  );
}
