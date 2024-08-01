import { startStandaloneServer } from '@apollo/server/standalone';
import { server as commentsServer } from './comments';
import { server as postsServer } from './posts';
import { server as usersServer } from './users';

export const servers = [
  { name: 'users', server: usersServer },
  { name: 'posts', server: postsServer },
  { name: 'comments', server: commentsServer },
];

export function startServers() {
  return Promise.all(
    servers.map(async ({ server, name }) => {
      const { url } = await startStandaloneServer(server, { listen: { port: 0 } });

      console.log(name, url);

      return { name, url, server };
    }),
  );
}
