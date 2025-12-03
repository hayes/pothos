import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../prisma/client/client';
import { pubsub } from './pubsub';

const adapter = new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' });
export const db = new PrismaClient({ adapter }).$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        if (
          operation === 'create' ||
          operation === 'update' ||
          operation === 'delete' ||
          operation === 'deleteMany' ||
          operation === 'updateMany' ||
          operation === 'createMany'
        ) {
          console.log(`🚀 ${operation} ${model}`);
          pubsub.publish(`dbUpdated${model}`, {});
        }
        return result;
      },
    },
  },
});
