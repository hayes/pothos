import { createTestServer } from '@pothos/test-utils';
import type { BaseContext } from './builder';
import { db } from './db';
import { schema } from './schema';

const server = createTestServer({
  schema,
  context: async ({ request }): Promise<BaseContext> => {
    const userId = request.headers.get('authorization');

    if (!userId) {
      return {
        roles: [],
      };
    }

    const user = await db.query.users.findFirst({
      columns: {
        id: true,
      },
      with: {
        roles: {
          with: {
            role: true,
          },
        },
      },
      where: (user, { eq }) => eq(user.id, Number.parseInt(userId, 10)),
    });

    return {
      user: user ?? undefined,
      roles: user?.roles.map((role) => role.role.name) ?? [],
    };
  },
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
