import { startStandaloneServer } from '@apollo/server/standalone';
import { server as accountsServer } from './accounts';
import { server as inventoryServer } from './inventory';
import { server as productsServer } from './products';
import { server as reviewsServer } from './reviews';

export const servers = [
  { name: 'accounts', server: accountsServer },
  { name: 'inventory', server: inventoryServer },
  { name: 'products', server: productsServer },
  { name: 'reviews', server: reviewsServer },
];

export function startServers() {
  return Promise.all(
    servers.map(async ({ server, name }) => {
      const { url } = await startStandaloneServer(server, { listen: { port: 0 } });

      return { name, url, server };
    }),
  );
}
